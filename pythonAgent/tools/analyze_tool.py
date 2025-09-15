"""
Analyze tool for finding hardcoded strings in React files.
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any
from tools.base_tool import BaseTool


class AnalyzeTool(BaseTool):
    """Tool for analyzing React files to find hardcoded strings."""
    
    async def execute(self) -> dict:
        """Execute the analyze tool."""
        self.log('Analyzing files for hardcoded strings...')
        
        # Get files from agent's memory/state
        state = self.agent.state_manager.get_state()
        files = state.context.files_to_process or []
        
        self.log(f'  Analyzing {len(files)} files for hardcoded strings...')
        
        if len(files) == 0:
            self.log('  No files to analyze')
            return {'files_analyzed': 0, 'strings_found': 0, 'files': {}}
        
        analysis_results = {
            'files_analyzed': 0,
            'strings_found': 0,
            'files': {}
        }
        
        for file_path in files:
            if Path(file_path).exists():
                try:
                    content = Path(file_path).read_text(encoding='utf-8')
                    strings = await self._find_hardcoded_strings_with_claude(content, file_path)
                    
                    if len(strings) > 0:
                        analysis_results['files_analyzed'] += 1
                        analysis_results['strings_found'] += len(strings)
                        analysis_results['files'][file_path] = {
                            'strings': strings,
                            'count': len(strings),
                            'complexity': self._calculate_complexity(strings),
                            'needs_use_translation': 'useTranslation' not in content,
                            'has_i18n_setup': 'next-i18next' in content or 'react-i18next' in content
                        }
                        
                        self.log(f'  {file_path}: {len(strings)} strings found')
                    else:
                        self.log(f'  {file_path}: No strings found')
                        
                except Exception as error:
                    self.error(f'Error reading {file_path}: {error}')
            else:
                self.log(f'  File not found: {file_path}')
        
        # Store results in agent state and update phase
        self.agent.state_manager.update_context({
            'strings_found': analysis_results['strings_found'],
            'analysis_results': analysis_results
        })
        
        self.agent.state_manager.update_state({
            'phase': 'analyzing'
        })
        
        return analysis_results
    
    async def _find_hardcoded_strings_with_claude(self, content: str, file_path: str) -> List[Dict[str, Any]]:
        """Find hardcoded strings using Claude."""
        try:
            prompt = f"""Find ALL user-facing text in this React file. Return JSON with phrases array.

INCLUDE:
- Button text content
- Link text content  
- Label text content
- Alt text (alt="...")
- Placeholder text (placeholder="...")
- Aria labels (aria-label="...")
- Title attributes (title="...")
- Any visible text users see
- Error messages, notifications, tooltips
- Form labels and help text

EXCLUDE:
- HTML IDs, CSS classes, variable names
- Code logic, function names
- URLs, file paths, technical values
- Comments and console.log statements

Generate semantic keys like "button.save", "menu.my_books", "alt.logo", "placeholder.email"

Return only valid JSON: {{"phrases": [{{"text": "original", "key": "semantic.key"}}]}}

File: {file_path}

```jsx
{content}
```"""

            
            response = await self.ask_claude(prompt, 2000)
            
            # Extract JSON from markdown code blocks if present
            json_text = self._extract_json_from_response(response)
            
            try:
                result = json.loads(json_text)
            except json.JSONDecodeError as parse_error:
                self.log(f'  JSON parsing failed: {parse_error}')
                self.log(f'  Raw response: {json_text[:200]}...')
                return []
            
            phrase_count = len(result.get('phrases', []))
            
            if phrase_count > 0:
                phrases_text = ', '.join([p['text'] for p in result['phrases']])
                self.log(f'  Found {phrase_count} phrases: {phrases_text}')
            else:
                self.log('  No phrases found')
            
            # Convert to our format
            return [{
                'text': phrase['text'],
                'key': phrase['key'],
                'line': self._find_line_number(content, phrase['text']),
                'context': self._find_context(content, phrase['text'])
            } for phrase in result.get('phrases', [])]

        except Exception as error:
            self.error(f'Claude analysis failed for {file_path}: {error}')
            return []
    
    def _extract_json_from_response(self, response: str) -> str:
        """Extract JSON from Claude's response, handling markdown code blocks."""
        # Try multiple patterns to handle different response formats
        json_match = re.search(r'```(?:json)?\s*\n?(\{[\s\S]*?\})\s*```', response)
        if json_match:
            return json_match.group(1)
        
        # Try pattern without language specification
        json_match = re.search(r'```\s*\n?(\{[\s\S]*?\})\s*```', response)
        if json_match:
            return json_match.group(1)
        
        # Try pattern with just the opening brace
        json_match = re.search(r'(\{[\s\S]*?\})', response)
        if json_match:
            return json_match.group(1)
        
        return response
    
    def _find_line_number(self, content: str, text: str) -> int:
        """Find the line number where text appears."""
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if text in line:
                return i + 1
        return 1
    
    def _find_context(self, content: str, text: str) -> str:
        """Find the context line where text appears."""
        lines = content.split('\n')
        for line in lines:
            if text in line:
                return line.strip()
        return ''
    
    def _calculate_complexity(self, strings: List[Dict[str, Any]]) -> int:
        """Calculate complexity based on string count and types."""
        complexity = len(strings)
        
        # Add complexity for different string types
        type_weights = {
            'jsx-text': 1,
            'button-text': 2,
            'notify-message': 3,
            'jsx-attr': 1,
            'link-text': 2,
            'label-text': 2
        }
        
        for string in strings:
            string_type = string.get('type', 'jsx-text')
            complexity += type_weights.get(string_type, 1)
        
        return complexity
