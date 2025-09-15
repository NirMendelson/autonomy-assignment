"""
Locale tool for creating locale files.
"""

import json
from pathlib import Path
from typing import Dict, List, Any
from tools.base_tool import BaseTool


class LocaleTool(BaseTool):
    """Tool for creating locale files."""
    
    async def execute(self) -> dict:
        """Execute the locale tool."""
        self.log('Creating locale files...')
        
        # Get translation results from agent state
        state = self.agent.state_manager.get_state()
        translate_results = state.translate_results or {'translations': []}
        target_language = state.target_language or 'es'
        
        results = {
            'locale_files_created': 0,
            'files': {}
        }
        
        # Create locale directory if it doesn't exist
        locale_dir = Path('locales') / target_language
        if not locale_dir.exists():
            self.log(f'  Creating locale directory: {locale_dir}')
            locale_dir.mkdir(parents=True, exist_ok=True)
        
        # Create Spanish common.json file
        spanish_file = locale_dir / 'common.json'
        spanish_translations = self._build_common_translations(translate_results.get('translations', []))
        
        try:
            spanish_file.write_text(json.dumps(spanish_translations, indent=2, ensure_ascii=False), encoding='utf-8')
            self.log(f'  Successfully wrote Spanish common.json')
            results['locale_files_created'] += 1
            results['files'][str(spanish_file)] = len(spanish_translations)
        except Exception as error:
            self.log(f'  Failed to write Spanish common.json: {error}')
            raise error
        
        # Create English common.json file
        english_dir = Path('locales') / 'en'
        if not english_dir.exists():
            self.log(f'  Creating English locale directory: {english_dir}')
            english_dir.mkdir(parents=True, exist_ok=True)
        
        english_file = english_dir / 'common.json'
        english_translations = self._build_english_translations(translate_results.get('translations', []))
        
        try:
            english_file.write_text(json.dumps(english_translations, indent=2, ensure_ascii=False), encoding='utf-8')
            self.log(f'  Successfully wrote English common.json')
            results['locale_files_created'] += 1
            results['files'][str(english_file)] = len(english_translations)
        except Exception as error:
            self.log(f'  Failed to write English common.json: {error}')
            raise error
        
        # Store results in agent state
        self.agent.state_manager.update_state({'locale_results': results})
        
        # Update phase to indicate locale creation is complete
        if results['locale_files_created'] > 0:
            self.agent.state_manager.update_state({'phase': 'locale_complete'})
            self.log(f'  Locale phase complete - {results["locale_files_created"]} files created')
        else:
            self.log(f'  No locale files were created')
        
        return results
    
    def _build_common_translations(self, translations: List[Dict[str, Any]]) -> Dict[str, str]:
        """Build Spanish translations for common.json."""
        common = {}
        
        # Handle array of translations (from TranslateTool)
        if isinstance(translations, list):
            for translation in translations:
                if translation.get('key') and translation.get('translation'):
                    common[translation['key']] = translation['translation']
        elif isinstance(translations, dict):
            # Handle object format (legacy)
            for category_translations in translations.values():
                if isinstance(category_translations, list):
                    for translation in category_translations:
                        if translation.get('key') and translation.get('translation'):
                            common[translation['key']] = translation['translation']
        
        return common
    
    def _build_english_translations(self, translations: List[Dict[str, Any]]) -> Dict[str, str]:
        """Build English translations for common.json."""
        english = {}
        
        # Handle array of translations (from TranslateTool)
        if isinstance(translations, list):
            for translation in translations:
                if translation.get('key') and translation.get('text'):
                    english[translation['key']] = translation['text']  # Use original English text
        elif isinstance(translations, dict):
            # Handle object format (legacy)
            for category_translations in translations.values():
                if isinstance(category_translations, list):
                    for translation in category_translations:
                        if translation.get('key') and translation.get('text'):
                            english[translation['key']] = translation['text']  # Use original English text
        
        return english
