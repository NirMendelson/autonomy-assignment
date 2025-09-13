"""
Main CLI entrypoint for the i18n agent.
"""

import os
import sys
import yaml
import click
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.text import Text

from .ast_js import JavaScriptASTParser, FileScanner
from .safety import SafetyValidator
from .llm import LLMClassifier
from .transformer import CodeTransformer
from .backup import BackupManager


console = Console()


class I18nAgent:
    """Main i18n agent class."""
    
    def __init__(self, root_dir: str, config_path: str = None):
        self.root_dir = root_dir
        self.config_path = config_path or os.path.join(root_dir, 'agent', 'config.yaml')
        self.config = self._load_config()
        
        # Initialize components
        self.parser = JavaScriptASTParser()
        self.scanner = FileScanner(self.config)
        self.validator = SafetyValidator(self.config)
        self.llm = LLMClassifier(self.config)
        self.transformer = CodeTransformer(self.config)
        self.backup_manager = BackupManager(root_dir)
        
        # State
        self.candidates = []
        self.classifications = []
        self.transformations = []
    
    def _load_config(self) -> dict:
        """Load configuration from YAML file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            console.print(f"[red]Error loading config: {e}[/red]")
            return {}
    
    def scan(self) -> dict:
        """Scan files for string candidates."""
        console.print("[blue]Scanning files for string candidates...[/blue]")
        
        # Find files to scan
        files = self.scanner.find_files(self.root_dir)
        console.print(f"Found {len(files)} files to scan")
        
        all_candidates = []
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Scanning files...", total=len(files))
            
            for file_path in files:
                progress.update(task, description=f"Scanning {os.path.basename(file_path)}")
                
                # Parse file
                result = self.parser.parse_file(file_path)
                if not result:
                    continue
                
                tree, content = result
                
                # Find string literals
                candidates = self.parser.find_string_literals(tree, file_path, content)
                
                # Add code context
                for candidate in candidates:
                    candidate['context'] = self.parser.get_code_context(tree, tree.root_node, content)
                
                all_candidates.extend(candidates)
                progress.advance(task)
        
        # Filter and prioritize candidates
        self.candidates = self.validator.get_ui_priority_strings(all_candidates)
        
        console.print(f"[green]Found {len(self.candidates)} string candidates[/green]")
        
        return {
            'files_scanned': len(files),
            'candidates_found': len(all_candidates),
            'ui_candidates': len(self.candidates),
            'candidates': self.candidates
        }
    
    def generate_scan_json(self) -> dict:
        """Generate simple JSON report of strings to replace by file."""
        if not self.candidates:
            return {}
        
        # Filter out technical strings and focus on UI text
        ui_candidates = []
        for candidate in self.candidates:
            text = candidate['text']
            skip_reason = candidate.get('skip_reason', '')
            
            # Skip if already marked for skipping
            if skip_reason:
                continue
            
            # Skip technical strings
            if self._is_technical_string(text):
                continue
            
            # Only include likely UI strings
            if (candidate.get('is_jsx_text', False) or 
                candidate.get('is_button_text', False) or 
                candidate.get('is_link_text', False) or
                candidate.get('is_function_call_text', False) or
                candidate.get('is_object_property', False) and len(text) > 3 or
                candidate.get('node_type') == 'jsx_attribute' or
                candidate.get('is_template_string', False) or
                candidate.get('node_type') == 'string_fragment'):
                ui_candidates.append(candidate)
            
            # Debug: Check if Admin is being filtered out
            if text == 'Admin':
                print(f"DEBUG: Admin filtering - is_object_property: {candidate.get('is_object_property', False)}, len: {len(text)}")
                print(f"DEBUG: Admin should be included: {candidate.get('is_object_property', False) and len(text) > 3}")
        
        # Group by file
        file_groups = {}
        for candidate in ui_candidates:
            file_path = candidate['file_path']
            rel_path = os.path.relpath(file_path, self.root_dir)
            
            if rel_path not in file_groups:
                file_groups[rel_path] = []
            
            file_groups[rel_path].append({
                'line': candidate['line'],
                'text': candidate['text'],
                'tag': candidate.get('jsx_tag', 'unknown')
            })
        
        # Sort by line number within each file
        for file_path in file_groups:
            file_groups[file_path].sort(key=lambda x: x['line'])
        
        return file_groups
    
    def _is_technical_string(self, text: str) -> bool:
        """Check if string is technical (not UI text)."""
        text_stripped = text.strip()
        
        # Debug: Check if this is the Admin string
        if text == 'Admin':
            print(f"DEBUG: Technical string check for 'Admin' - text: '{text}'")
            print(f"DEBUG: text_stripped: '{text_stripped}'")
        
        # Skip CSS values
        if (text.startswith('#') or
            text.endswith('px') or
            text.endswith('em') or
            text.endswith('%') or
            'px' in text or
            'em' in text or
            'rem' in text):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS values filter")
            return True

        # Skip import paths
        if ('@mui/' in text or
            'next/' in text or
            'react' in text or
            text.startswith('./') or
            text.startswith('../')):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by import paths filter")
            return True

        # Skip very short strings
        if len(text_stripped) < 3:
            if text == 'Admin':
                print(f"DEBUG: Admin caught by short strings filter - len: {len(text_stripped)}")
            return True

        # Skip CSS values with spaces (like " nowrap")
        if text.startswith(' ') or text.endswith(' '):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS spaces filter")
            return True

        # Skip CSS keywords
        css_values = {
            'nowrap', 'wrap', 'pre', 'pre-wrap', 'pre-line', 'hidden', 'visible',
            'block', 'inline', 'flex', 'grid', 'absolute', 'relative', 'fixed',
            'static', 'sticky', 'left', 'right', 'center', 'justify', 'start',
            'end', 'space-between', 'space-around', 'space-evenly', 'baseline',
            'stretch', 'normal', 'bold', 'italic', 'underline', 'none', 'auto'
        }
        if text_stripped in css_values:
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS keywords filter - text_stripped: '{text_stripped}'")
            return True

        # Skip CSS measurements
        import re
        if re.match(r'^\d+(px|em|rem|%|vh|vw|pt|pc|in|cm|mm)$', text_stripped):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS measurements filter")
            return True

        if text == 'Admin':
            print(f"DEBUG: Admin passed all technical string filters - returning False")
        return False
    
    def classify(self) -> dict:
        """Classify string candidates using LLM."""
        if not self.candidates:
            console.print("[yellow]No candidates to classify. Run scan first.[/yellow]")
            return {}
        
        console.print("[blue]Classifying string candidates with LLM...[/blue]")
        
        # Filter out already skipped candidates
        to_classify = [c for c in self.candidates if 'skip_reason' not in c]
        
        if not to_classify:
            console.print("[yellow]No candidates need classification[/yellow]")
            return {}
        
        console.print(f"Classifying {len(to_classify)} candidates...")
        
        # Classify with LLM
        self.classifications = self.llm.classify_strings(to_classify)
        
        # Merge with original candidates
        for classification in self.classifications:
            for candidate in self.candidates:
                if candidate['text'] == classification['text'] and candidate['file_path'] == classification['file_path']:
                    candidate.update(classification)
                    break
        
        # Count results
        replace_count = len([c for c in self.candidates if c.get('action') == 'replace'])
        skip_count = len([c for c in self.candidates if c.get('action') == 'skip'])
        
        console.print(f"[green]Classification complete: {replace_count} to replace, {skip_count} to skip[/green]")
        
        return {
            'total_classified': len(self.classifications),
            'to_replace': replace_count,
            'to_skip': skip_count,
            'classifications': self.classifications
        }
    
    def apply(self) -> dict:
        """Apply i18n transformations to files."""
        if not self.candidates:
            console.print("[yellow]No candidates to transform. Run scan and classify first.[/yellow]")
            return {}
        
        console.print("[blue]Applying i18n transformations...[/blue]")
        
        # Group transformations by file
        file_transformations = {}
        for candidate in self.candidates:
            if candidate.get('action') != 'replace':
                continue
            
            file_path = candidate['file_path']
            if file_path not in file_transformations:
                file_transformations[file_path] = []
            file_transformations[file_path].append(candidate)
        
        # Transform files
        transformed_files = []
        total_transformations = 0
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Transforming files...", total=len(file_transformations))
            
            for file_path, transformations in file_transformations.items():
                progress.update(task, description=f"Transforming {os.path.basename(file_path)}")
                
                # Transform file
                new_content, applied = self.transformer.transform_file(file_path, transformations)
                
                if applied:
                    # Write transformed content
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    
                    # Add useTranslation import if needed
                    self.transformer._ensure_use_translation_import(file_path)
                    
                    transformed_files.append({
                        'file': file_path,
                        'transformations': applied
                    })
                    total_transformations += len(applied)
                
                progress.advance(task)
        
        # Generate locale files
        console.print("[blue]Generating locale files...[/blue]")
        locale_files = self.transformer.generate_locale_files(
            [c for c in self.candidates if c.get('action') == 'replace'],
            self.root_dir
        )
        
        # Generate i18n config
        console.print("[blue]Generating i18n configuration...[/blue]")
        i18n_config_file = self.transformer.generate_i18n_config(self.root_dir)
        
        # Update _app.jsx
        app_file = os.path.join(self.root_dir, 'pages', '_app.jsx')
        if os.path.exists(app_file):
            self.transformer.update_app_jsx(app_file)
        
        # Create language switcher
        switcher_file = self.transformer.create_language_switcher(self.root_dir)
        
        console.print(f"[green]Applied {total_transformations} transformations to {len(transformed_files)} files[/green]")
        console.print(f"[green]Generated {len(locale_files)} locale files[/green]")
        
        return {
            'transformed_files': len(transformed_files),
            'total_transformations': total_transformations,
            'locale_files': locale_files,
            'i18n_config': i18n_config_file,
            'language_switcher': switcher_file
        }
    
    def backup(self) -> str:
        """Create backup of frontend files."""
        console.print("[blue]Creating backup of frontend files...[/blue]")
        
        frontend_files = self.backup_manager.get_frontend_files()
        backup_id = self.backup_manager.create_backup(frontend_files)
        
        console.print(f"[green]Backup created: {backup_id}[/green]")
        return backup_id
    
    def restore(self, backup_id: str = None) -> bool:
        """Restore frontend files from backup."""
        if not backup_id:
            # Use latest backup
            backups = self.backup_manager.list_backups()
            if not backups:
                console.print("[red]No backups found[/red]")
                return False
            backup_id = backups[0]['backup_id']
        
        console.print(f"[blue]Restoring from backup: {backup_id}[/blue]")
        
        success = self.backup_manager.restore_backup(backup_id)
        if success:
            # Clean up generated files
            self.backup_manager.cleanup_generated_files()
            console.print("[green]Restore complete[/green]")
        else:
            console.print("[red]Restore failed[/red]")
        
        return success
    
    def report(self) -> dict:
        """Generate a report of the i18n process."""
        console.print("[blue]Generating report...[/blue]")
        
        # Count statistics
        total_candidates = len(self.candidates)
        replace_candidates = len([c for c in self.candidates if c.get('action') == 'replace'])
        skip_candidates = len([c for c in self.candidates if c.get('action') == 'skip'])
        
        # Group by file
        file_stats = {}
        for candidate in self.candidates:
            file_path = candidate['file_path']
            if file_path not in file_stats:
                file_stats[file_path] = {'total': 0, 'replace': 0, 'skip': 0}
            
            file_stats[file_path]['total'] += 1
            if candidate.get('action') == 'replace':
                file_stats[file_path]['replace'] += 1
            else:
                file_stats[file_path]['skip'] += 1
        
        # Create report table
        table = Table(title="i18n Agent Report")
        table.add_column("File", style="cyan")
        table.add_column("Total", justify="right")
        table.add_column("Replace", justify="right", style="green")
        table.add_column("Skip", justify="right", style="yellow")
        
        for file_path, stats in file_stats.items():
            rel_path = os.path.relpath(file_path, self.root_dir)
            table.add_row(
                rel_path,
                str(stats['total']),
                str(stats['replace']),
                str(stats['skip'])
            )
        
        console.print(table)
        
        # Summary
        summary = f"""
[bold]Summary:[/bold]
- Total candidates: {total_candidates}
- To replace: {replace_candidates}
- To skip: {skip_candidates}
- Files processed: {len(file_stats)}
        """
        
        console.print(Panel(summary, title="Report Summary"))
        
        return {
            'total_candidates': total_candidates,
            'replace_candidates': replace_candidates,
            'skip_candidates': skip_candidates,
            'files_processed': len(file_stats),
            'file_stats': file_stats
        }


@click.command()
@click.option('--root', default='.', help='Project root directory')
@click.option('--config', help='Config file path')
@click.option('--scan', is_flag=True, help='Scan files for string candidates')
@click.option('--scan-json', is_flag=True, help='Scan files and output JSON report')
@click.option('--classify', is_flag=True, help='Classify candidates with LLM')
@click.option('--apply', is_flag=True, help='Apply i18n transformations')
@click.option('--backup', is_flag=True, help='Create backup of frontend files')
@click.option('--restore', is_flag=True, help='Restore frontend files from backup')
@click.option('--report', is_flag=True, help='Generate report')
@click.option('--backup-id', help='Specific backup ID to restore')
def main(root, config, scan, scan_json, classify, apply, backup, restore, report, backup_id):
    """i18n Agent - Automatically add internationalization to React apps."""
    
    # Initialize agent
    agent = I18nAgent(root, config)
    
    # Execute commands
    if scan:
        agent.scan()
    
    if scan_json:
        agent.scan()
        json_report = agent.generate_scan_json()
        import json
        
        # Save JSON to file
        json_file = os.path.join(root, 'agent', 'scan_report.json')
        os.makedirs(os.path.dirname(json_file), exist_ok=True)
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(json_report, f, indent=2, ensure_ascii=False)
        
        console.print(f"[green]Scan report saved to: {json_file}[/green]")
        console.print(f"[blue]Found {len(json_report)} files with UI strings to replace[/blue]")
        
        # Show summary
        total_strings = sum(len(strings) for strings in json_report.values())
        console.print(f"[blue]Total UI strings found: {total_strings}[/blue]")
        
        # Show file summary
        for file_path, strings in json_report.items():
            console.print(f"[cyan]{file_path}: {len(strings)} strings[/cyan]")
            for item in strings:
                console.print(f"  Line {item['line']} ({item['tag']}): \"{item['text']}\"")
    
    if classify:
        agent.classify()
    
    if apply:
        agent.apply()
    
    if backup:
        agent.backup()
    
    if restore:
        agent.restore(backup_id)
    
    if report:
        agent.report()
    
    # If no flags provided, show help
    if not any([scan, scan_json, classify, apply, backup, restore, report]):
        console.print("[yellow]No action specified. Use --help to see available options.[/yellow]")


if __name__ == '__main__':
    main()
