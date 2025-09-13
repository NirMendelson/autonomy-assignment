"""
Code transformation utilities for i18n implementation.
"""

import os
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path


class CodeTransformer:
    """Transforms code by replacing strings with i18n calls."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.i18n_config = config.get('i18n', {})
        self.default_locale = self.i18n_config.get('default_locale', 'en')
        self.locales = self.i18n_config.get('locales', ['en'])
        self.namespace = self.i18n_config.get('namespace', 'common')
    
    def transform_file(self, file_path: str, transformations: List[Dict[str, Any]]) -> Tuple[str, List[str]]:
        """Transform a file by applying i18n replacements."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        applied_transformations = []
        
        # Sort transformations by line number (descending) to avoid offset issues
        transformations.sort(key=lambda x: x['line'], reverse=True)
        
        lines = content.split('\n')
        
        for transformation in transformations:
            if transformation['action'] != 'replace':
                continue
            
            line_idx = transformation['line'] - 1
            if line_idx >= len(lines):
                continue
            
            original_line = lines[line_idx]
            transformed_line = self._transform_line(original_line, transformation)
            
            if transformed_line != original_line:
                lines[line_idx] = transformed_line
                applied_transformations.append({
                    'key': transformation['key'],
                    'original': transformation['text'],
                    'line': transformation['line']
                })
        
        return '\n'.join(lines), applied_transformations
    
    def _transform_line(self, line: str, transformation: Dict[str, Any]) -> str:
        """Transform a single line with i18n replacement."""
        text = transformation['text']
        key = transformation['key']
        wrapper = transformation.get('wrapper', 't')
        
        if wrapper == 't':
            # Simple t() replacement
            replacement = f"{{t('{key}')}}"
        else:
            # <Trans> replacement for complex markup
            replacement = f"<Trans i18nKey='{key}'>{text}</Trans>"
        
        # More precise string replacement - only replace exact string matches
        # Handle different quote types with word boundaries
        quote_patterns = [
            (f'"{re.escape(text)}"', f'"{replacement}"'),
            (f"'{re.escape(text)}'", f"'{replacement}'"),
            (f"`{re.escape(text)}`", f"`{replacement}`"),
            # Handle strings without quotes (in JSX text)
            (f'>{re.escape(text)}<', f'>{replacement}<'),
            (f'>{re.escape(text)}</', f'>{replacement}</'),
        ]
        
        for pattern, replacement_pattern in quote_patterns:
            if re.search(pattern, line):
                return re.sub(pattern, replacement_pattern, line)
        
        return line
    
    def generate_locale_files(self, transformations: List[Dict[str, Any]], output_dir: str) -> Dict[str, str]:
        """Generate locale JSON files from transformations."""
        locale_files = {}
        
        # Group transformations by locale
        for locale in self.locales:
            locale_data = {}
            
            for transformation in transformations:
                if transformation['action'] != 'replace':
                    continue
                
                key = transformation['key']
                default_message = transformation['text']
                
                # For non-default locales, use the default message as fallback
                if locale == self.default_locale:
                    locale_data[key] = default_message
                else:
                    # For other locales, you might want to use translation services
                    # For now, we'll use the same text
                    locale_data[key] = default_message
            
            # Create locale directory
            locale_dir = os.path.join(output_dir, 'locales', locale)
            os.makedirs(locale_dir, exist_ok=True)
            
            # Write locale file
            locale_file = os.path.join(locale_dir, f'{self.namespace}.json')
            with open(locale_file, 'w', encoding='utf-8') as f:
                json.dump(locale_data, f, indent=2, ensure_ascii=False)
            
            locale_files[locale] = locale_file
        
        return locale_files
    
    def generate_i18n_config(self, output_dir: str) -> str:
        """Generate i18n configuration file."""
        config_content = """import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    common: require('./locales/en/""" + self.namespace + """.json')
  },
  he: {
    common: require('./locales/he/""" + self.namespace + """.json')
  }
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: '""" + self.default_locale + """',
    fallbackLng: '""" + self.default_locale + """',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: false,
    },
  });

export default i18n;
"""
        
        config_file = os.path.join(output_dir, 'i18n.js')
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(config_content)
        
        return config_file
    
    def update_app_jsx(self, app_file_path: str) -> bool:
        """Update _app.jsx to include i18n provider."""
        try:
            with open(app_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if i18n is already imported
            if 'import i18n' in content:
                return False
            
            # Add i18n import at the top
            import_line = "import '../i18n';"
            
            # Find the first import statement
            lines = content.split('\n')
            import_idx = 0
            for i, line in enumerate(lines):
                if line.strip().startswith('import '):
                    import_idx = i
                    break
            
            # Insert i18n import
            lines.insert(import_idx, import_line)
            
            # Write updated content
            with open(app_file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            return True
            
        except Exception as e:
            print(f"Error updating _app.jsx: {e}")
            return False
    
    def add_use_translation_import(self, file_path: str) -> bool:
        """Add useTranslation import to a file that uses t() function."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if useTranslation is already imported
            if 'useTranslation' in content:
                return False
            
            # Check if file uses t() function
            if 't(' not in content:
                return False
            
            # Add useTranslation import
            import_line = "import { useTranslation } from 'react-i18next';"
            
            # Find the first import statement
            lines = content.split('\n')
            import_idx = 0
            for i, line in enumerate(lines):
                if line.strip().startswith('import '):
                    import_idx = i
                    break
            
            # Insert useTranslation import
            lines.insert(import_idx, import_line)
            
            # Write updated content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            return True
            
        except Exception as e:
            print(f"Error adding useTranslation import to {file_path}: {e}")
            return False
    
    def create_language_switcher(self, output_dir: str) -> str:
        """Create a simple language switcher component."""
        switcher_content = """import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };
  
  return (
    <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 1000 }}>
      <button 
        onClick={() => changeLanguage('en')}
        style={{ 
          margin: '0 5px', 
          padding: '5px 10px',
          backgroundColor: i18n.language === 'en' ? '#007bff' : '#f8f9fa',
          color: i18n.language === 'en' ? 'white' : 'black',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        EN
      </button>
      <button 
        onClick={() => changeLanguage('he')}
        style={{ 
          margin: '0 5px', 
          padding: '5px 10px',
          backgroundColor: i18n.language === 'he' ? '#007bff' : '#f8f9fa',
          color: i18n.language === 'he' ? 'white' : 'black',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        עבר
      </button>
    </div>
  );
};

export default LanguageSwitcher;
"""
        
        switcher_file = os.path.join(output_dir, 'components', 'LanguageSwitcher.jsx')
        os.makedirs(os.path.dirname(switcher_file), exist_ok=True)
        
        with open(switcher_file, 'w', encoding='utf-8') as f:
            f.write(switcher_content)
        
        return switcher_file
