"""
Translate tool for generating translations.
"""

from typing import Dict, List, Any
from tools.base_tool import BaseTool


class TranslateTool(BaseTool):
    """Tool for generating translations."""
    
    async def execute(self) -> dict:
        """Execute the translate tool."""
        target_language = self.agent.state_manager.get_state().target_language or 'es'
        self.log(f'Translating strings to {target_language.upper()}...')
        
        # Get analysis results from agent state
        state = self.agent.state_manager.get_state()
        analysis_results = state.context.analysis_results or {'files': {}}
        
        results = {
            'strings_translated': 0,
            'translations': {}
        }
        
        # Collect all strings from analysis results
        all_strings = []
        for file_path, file_data in analysis_results.get('files', {}).items():
            if file_data.get('strings') and len(file_data['strings']) > 0:
                all_strings.extend(file_data['strings'])
        
        if len(all_strings) > 0:
            self.log(f'  Found {len(all_strings)} strings to translate')
            string_texts = [s['text'] for s in all_strings]
            self.log(f'  Strings: {", ".join(string_texts)}')
            
            translations = await self._translate_strings(all_strings, target_language)
            
            self.log(f'  Translation completed: {len(translations)} translations')
            results['translations'] = translations
            results['strings_translated'] = len(translations)
        else:
            self.log('  No strings found to translate')
        
        # Store results in agent state
        self.agent.state_manager.update_state({'translate_results': results})
        
        # Update phase to indicate translations are complete
        if results['strings_translated'] > 0:
            self.agent.state_manager.update_state({'phase': 'translating_complete'})
            self.log(f'  Translation phase complete - {results["strings_translated"]} strings translated')
        
        return results
    
    async def _translate_strings(self, strings: List[Dict[str, Any]], target_language: str) -> List[Dict[str, Any]]:
        """Translate strings using Claude."""
        self.log(f'  Calling Claude to translate {len(strings)} strings to {target_language}...')
        
        prompt = f"""You are a professional translator specializing in software localization.

TASK: Translate the following strings from English to {self._get_language_name(target_language)}.

CONTEXT: These are user interface strings for a React/Next.js application.

TRANSLATION GUIDELINES:
1. Maintain the same tone and style as the original
2. Keep technical terms consistent
3. Preserve any special characters or formatting
4. Make translations natural and user-friendly
5. Keep button text concise and action-oriented
6. Ensure labels are clear and descriptive

STRINGS TO TRANSLATE:
{chr(10).join([f'- "{s["text"]}" (key: {s["key"]})' for s in strings])}

Please respond with ONLY the translations in this exact format:
key: "translated_text"
key: "translated_text"
..."""

        try:
            response = await self.ask_claude(prompt, 4000)
            self.log(f'  Claude response received: {len(response)} characters')
            self.log(f'  Response preview: {response[:200]}...')
            
            translations = self._parse_translations(response, strings)
            self.log(f'  Parsed {len(translations)} translations')
            
            return translations
        except Exception as error:
            self.error(f'Translation failed: {error}')
            return [{**s, 'translation': s['text']} for s in strings]  # Fallback to original
    
    def _parse_translations(self, response: str, strings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parse translations from Claude's response."""
        translations = []
        lines = response.split('\n')
        
        for string in strings:
            key = string['key']
            translation_line = next((line for line in lines if line.startswith(f'{key}:')), None)
            
            if translation_line:
                translation = translation_line.split(':', 1)[1].strip().strip('"\'')
                translations.append({
                    **string,
                    'translation': translation
                })
            else:
                # Fallback to original if translation not found
                translations.append({
                    **string,
                    'translation': string['text']
                })
        
        return translations
    
    def _get_language_name(self, code: str) -> str:
        """Get the full language name from code."""
        languages = {
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese',
            'ar': 'Arabic'
        }
        
        return languages.get(code, code.upper())
