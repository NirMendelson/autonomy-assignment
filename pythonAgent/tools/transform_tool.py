"""
Transform tool for converting hardcoded strings to t() calls.
"""

import re
from pathlib import Path
from typing import Dict, Any
from tools.base_tool import BaseTool


class TransformTool(BaseTool):
    """Tool for transforming hardcoded strings to translation calls."""
    
    async def execute(self) -> dict:
        """Execute the transform tool."""
        self.log('Transforming hardcoded strings...')
        
        # Get analysis results from agent state
        state = self.agent.state_manager.get_state()
        analysis_results = state.context.analysis_results or {'files': {}}
        
        results = {
            'files_transformed': 0,
            'files': {}
        }
        
        # Process files
        for file_path, file_analysis in analysis_results.get('files', {}).items():
            if file_analysis.get('strings') and len(file_analysis['strings']) > 0:
                try:
                    self.log(f'  Transforming {file_path}...')
                    transform_result = await self._transform_file(file_path, file_analysis)
                    if transform_result['success']:
                        results['files_transformed'] += 1
                        results['files'][file_path] = transform_result
                        self.log(f'  Successfully transformed {file_path}')
                    else:
                        self.log(f'  Failed to transform {file_path}: {transform_result.get("error", "Unknown error")}')
                except Exception as error:
                    self.error(f'Failed to transform {file_path}: {error}')
                    results['files'][file_path] = {'success': False, 'error': str(error)}
        
        # Store results in agent state
        self.agent.state_manager.update_state({'transform_results': results})
        
        # Update phase to indicate transformation is complete
        if results['files_transformed'] > 0:
            self.agent.state_manager.update_state({'phase': 'transforming_complete'})
            self.log(f'  Transformation phase complete - {results["files_transformed"]} files transformed')
        
        return results
    
    async def _transform_file(self, file_path: str, file_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a single file to use t() calls."""
        if not file_path:
            return {'success': False, 'error': 'File path is undefined'}
        
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            self.log(f'  File not found: {file_path}')
            return {'success': False, 'error': 'File not found'}
        
        original_content = file_path_obj.read_text(encoding='utf-8')
        
        # Ask Claude to transform the file
        updated_content = await self._ask_claude_to_transform(file_path, original_content, file_analysis)
        
        if updated_content and updated_content != original_content:
            # Save the updated file
            file_path_obj.write_text(updated_content, encoding='utf-8')
            
            self.log('  File transformed successfully')
            return {
                'success': True,
                'changes': self._count_changes(original_content, updated_content),
                'original_length': len(original_content),
                'updated_length': len(updated_content)
            }
        
        # Check if file is already internationalized
        if 'useTranslation' in original_content and 't(' in original_content:
            self.log('  File already internationalized - no changes needed')
            return {
                'success': True,
                'changes': 0,
                'original_length': len(original_content),
                'updated_length': len(original_content),
                'already_transformed': True
            }
        
        self.log('  No changes made or Claude returned original content')
        return {'success': False, 'error': 'No changes made'}
    
    async def _ask_claude_to_transform(self, file_path: str, content: str, file_analysis: Dict[str, Any]) -> str:
        """Ask Claude to transform the file content."""
        strings = file_analysis.get('strings', [])
        
        prompt = f"""You are an expert React/Next.js internationalization specialist.

TASK: Transform this file to use i18n translation keys instead of hardcoded strings.

RULES:
1. Replace hardcoded user-facing strings with t('key') calls
2. Import useTranslation hook if not already imported
3. Use the suggested keys provided below
4. Only translate strings visible to end users (buttons, labels, messages, etc.)
5. Do NOT translate: HTML IDs, CSS classes, console.log messages, route paths, technical identifiers
6. Preserve all code functionality and formatting
7. Use proper JSX syntax and React patterns

FILE: {file_path}

STRINGS TO TRANSLATE:
{chr(10).join([f'- "{s["text"]}" → t("{s["key"]}")' for s in strings])}

CURRENT CONTENT:
```jsx
{content}
```

Please return the updated file content with i18n translations applied. Make sure to:
- Add the useTranslation import at the top
- Replace hardcoded strings with t('key') calls using the provided keys
- Maintain all existing functionality

Return ONLY the updated file content, no explanations."""

        try:
            result = await self.ask_claude(prompt, 8000)
            # Extract code from markdown code blocks if present
            extracted_code = self._extract_code_from_markdown(result)
            
            return extracted_code
        except Exception as error:
            self.error(f'Claude API error for {file_path}: {error}')
            return content  # Return original content if Claude fails
    
    def _extract_code_from_markdown(self, response: str) -> str:
        """Extract code from markdown code blocks."""
        # Look for code blocks with jsx, js, tsx, or ts language
        code_block_regex = r'```(?:jsx|js|tsx|ts|javascript|typescript)?\s*\n([\s\S]*?)\n```'
        match = re.search(code_block_regex, response)
        
        if match and match.group(1):
            return match.group(1).strip()
        
        # If no code block found, return the response as-is
        return response.strip()
    
    
    def _count_changes(self, original: str, updated: str) -> int:
        """Count the number of line changes between original and updated content."""
        original_lines = original.split('\n')
        updated_lines = updated.split('\n')
        
        changes = 0
        for i in range(max(len(original_lines), len(updated_lines))):
            if i >= len(original_lines) or i >= len(updated_lines) or original_lines[i] != updated_lines[i]:
                changes += 1
        
        return changes
