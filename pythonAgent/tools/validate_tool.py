"""
Validate tool for checking i18n implementation.
"""

import re
import subprocess
from pathlib import Path
from typing import Dict, List, Any
from tools.base_tool import BaseTool


class ValidateTool(BaseTool):
    """Tool for validating i18n implementation."""
    
    async def execute(self) -> dict:
        """Execute the validate tool."""
        self.log('  Validating i18n implementation...')
        
        # Get transform results from agent state
        state = self.agent.state_manager.get_state()
        transform_results = state.transform_results or {'files': {}}
        
        results = {
            'valid_files': 0,
            'invalid_files': 0,
            'files': {},
            'issues': [],
            'retry_attempts': 0,
            'max_retries': 3
        }
        
        # Validate each file with retry mechanism
        for file_path, file_result in transform_results.get('files', {}).items():
            if file_result.get('success'):
                validation = await self._validate_file_with_retry(file_path, results['max_retries'])
                results['files'][file_path] = validation
                
                if validation['is_valid']:
                    results['valid_files'] += 1
                else:
                    results['invalid_files'] += 1
                    results['issues'].extend(validation['issues'])
        
        # Store results in agent state
        self.agent.state_manager.update_state({'validate_results': results})
        
        # Update phase to indicate validation is complete
        if results['invalid_files'] == 0:
            self.agent.state_manager.update_state({'phase': 'validation_complete'})
            self.log(f'    Validation phase complete - {results["valid_files"]} files valid, {results["invalid_files"]} files invalid')
        else:
            self.log(f'    Validation phase complete - {results["valid_files"]} files valid, {results["invalid_files"]} files invalid with issues')
        
        return results
    
    async def _validate_file_with_retry(self, file_path: str, max_retries: int) -> Dict[str, Any]:
        """Validate a file with retry mechanism."""
        last_validation = None
        
        for attempt in range(1, max_retries + 1):
            self.log(f'    Validating {file_path} (attempt {attempt}/{max_retries})...')
            
            validation = await self._validate_file(file_path)
            last_validation = validation
            
            if validation['is_valid']:
                self.log(f'    File {file_path} is valid')
                return validation
            else:
                self.error(f'    File {file_path} has issues: {", ".join(validation["issues"])}')
                
                if attempt < max_retries:
                    self.log(f'    Attempting to fix issues in {file_path}...')
                    fixed = await self._attempt_fix(file_path, validation['issues'])
                    if fixed:
                        self.log(f'    Fixed issues in {file_path}, re-validating...')
                        continue
                    else:
                        self.error(f'    Could not fix issues in {file_path}')
        
        # If we get here, all retries failed
        self.error(f'    File {file_path} failed validation after {max_retries} attempts')
        return {
            **last_validation,
            'is_valid': False,
            'issues': last_validation['issues'] + [f'Failed after {max_retries} retry attempts']
        }
    
    async def _validate_file(self, file_path: str) -> Dict[str, Any]:
        """Validate a single file."""
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return {'is_valid': False, 'issues': ['File not found']}
        
        content = file_path_obj.read_text(encoding='utf-8')
        issues = []
        
        # 1. Check for syntax errors first (most critical)
        syntax_errors = await self._check_syntax_errors(file_path, content)
        if syntax_errors:
            issues.extend(syntax_errors)
            return {'is_valid': False, 'issues': issues, 'critical': True}
        
        # 2. Check for useTranslation import
        if 'useTranslation' not in content:
            issues.append('Missing useTranslation import')
        
        # 3. Check for t() function usage
        if 't(' not in content:
            issues.append('No t() function calls found')
        
        # 4. Check for hardcoded strings that should be translated
        hardcoded_strings = self._find_remaining_hardcoded_strings(content)
        if hardcoded_strings:
            issues.append(f'Found {len(hardcoded_strings)} remaining hardcoded strings')
        
        # 5. Check for proper i18n setup
        i18n_issues = self._check_i18n_setup(content)
        if i18n_issues:
            issues.extend(i18n_issues)
        
        return {
            'is_valid': len(issues) == 0,
            'issues': issues,
            'hardcoded_strings': hardcoded_strings,
            'critical': False
        }
    
    async def _check_syntax_errors(self, file_path: str, content: str) -> List[str]:
        """Check for syntax errors in the file."""
        try:
            # Try to run a basic syntax check
            if file_path.endswith('.jsx') or file_path.endswith('.js'):
                # For JSX/JS files, we can't easily check syntax without a proper parser
                # Just do basic checks
                if content.count('{') != content.count('}'):
                    return ['Mismatched braces']
                if content.count('(') != content.count(')'):
                    return ['Mismatched parentheses']
                if content.count('[') != content.count(']'):
                    return ['Mismatched brackets']
            return []
        except Exception as error:
            return [f'Syntax check failed: {error}']
    
    def _find_remaining_hardcoded_strings(self, content: str) -> List[Dict[str, Any]]:
        """Find hardcoded strings that should have been translated."""
        strings = []
        lines = content.split('\n')
        
        # Look for hardcoded strings that should have been translated
        patterns = [
            re.compile(r'>\s*([A-Z][^<{]+?)\s*<'),  # JSX text content
            re.compile(r'notify\([\'"]([^\'"]+)[\'"]'),  # Notify messages
            re.compile(r'<Button[^>]*>([^<]+)</Button>'),  # Button text
        ]
        
        for line_index, line in enumerate(lines):
            for pattern in patterns:
                matches = pattern.findall(line)
                for match in matches:
                    text = match.strip()
                    if self._is_likely_translatable(text):
                        strings.append({
                            'text': text,
                            'line': line_index + 1,
                            'context': line.strip()
                        })
        
        return strings
    
    def _is_likely_translatable(self, text: str) -> bool:
        """Check if a string is likely to be user-facing and translatable."""
        if len(text) < 2:
            return False
        
        # Skip technical strings
        technical_patterns = [
            r'^[a-z_]+$',  # snake_case
            r'^[A-Z][a-z]+[A-Z]',  # camelCase
            r'^[a-z]+-[a-z]+',  # kebab-case
            r'^\d+$',  # numbers only
            r'^[a-z]+://',  # URLs
            r'^#',  # CSS selectors
            r'^\.',  # CSS classes
        ]
        
        for pattern in technical_patterns:
            if re.match(pattern, text):
                return False
        
        # Must contain at least one letter
        if not re.search(r'[a-zA-Z]', text):
            return False
        
        return True
    
    def _check_i18n_setup(self, content: str) -> List[str]:
        """Check for proper i18n setup in the file."""
        issues = []
        
        # Check if file has both useTranslation import and t() usage
        has_import = 'useTranslation' in content
        has_usage = 't(' in content
        
        if has_usage and not has_import:
            issues.append('Using t() function but missing useTranslation import')
        
        if has_import and not has_usage:
            issues.append('Importing useTranslation but not using t() function')
        
        return issues
    
    async def _attempt_fix(self, file_path: str, issues: List[str]) -> bool:
        """Attempt to fix issues in a file."""
        # For now, just return False - we don't have auto-fix logic
        # This could be enhanced to automatically fix common issues
        return False
