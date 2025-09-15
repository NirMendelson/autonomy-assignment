"""
Setup tool for creating i18n configuration.
"""

import json
from pathlib import Path
from typing import Dict, Any
from tools.base_tool import BaseTool


class SetupTool(BaseTool):
    """Tool for setting up i18n configuration."""
    
    async def execute(self) -> dict:
        """Execute the setup tool."""
        self.log('  Setting up i18n configuration...')
        
        # Get target language from agent state
        state = self.agent.state_manager.get_state()
        target_language = state.target_language or 'es'
        
        results = {
            'config_files_created': 0,
            'files': {}
        }
        
        # Create lib directory if it doesn't exist
        lib_dir = Path('lib')
        if not lib_dir.exists():
            self.log('    Creating lib directory')
            lib_dir.mkdir(parents=True, exist_ok=True)
        
        # Create i18n configuration file
        i18n_config = self._create_i18n_config(target_language)
        i18n_file = lib_dir / 'i18n.js'
        
        try:
            i18n_file.write_text(i18n_config, encoding='utf-8')
            self.log('    Successfully wrote i18n.js')
            results['config_files_created'] += 1
            results['files'][str(i18n_file)] = 'i18n configuration'
        except Exception as error:
            self.log(f'    Failed to write i18n.js: {error}')
            raise error
        
        # Create i18n provider component
        provider_component = self._create_i18n_provider()
        provider_file = Path('components') / 'I18nProvider.jsx'
        
        # Create components directory if it doesn't exist
        components_dir = Path('components')
        if not components_dir.exists():
            self.log('    Creating components directory')
            components_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            provider_file.write_text(provider_component, encoding='utf-8')
            self.log('    Successfully wrote I18nProvider.jsx')
            results['config_files_created'] += 1
            results['files'][str(provider_file)] = 'i18n provider component'
        except Exception as error:
            self.log(f'    Failed to write I18nProvider.jsx: {error}')
            raise error
        
        # Store results in agent state
        self.agent.state_manager.update_state({'setup_results': results})
        
        # Update phase to indicate setup is complete
        if results['config_files_created'] > 0:
            self.agent.state_manager.update_state({'phase': 'setup_complete'})
            self.log(f'    Setup phase complete - {results["config_files_created"]} files created')
        
        return results
    
    def _create_i18n_config(self, target_language: str) -> str:
        """Create i18n configuration file content."""
        return f"""import i18n from 'i18next';
import {{ initReactI18next }} from 'react-i18next';

// Import locale files
import enCommon from '../locales/en/common.json';
import esCommon from '../locales/es/common.json';

const resources = {{
  en: {{
    common: enCommon
  }},
  es: {{
    common: esCommon
  }}
}};

i18n
  .use(initReactI18next)
  .init({{
    resources,
    lng: '{target_language}', // Default language
    fallbackLng: 'en', // Fallback language
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {{
      escapeValue: false, // React already does escaping
    }},
    
    // Namespace configuration
    defaultNS: 'common',
    ns: ['common'],
    
    // Language detection
    detection: {{
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    }}
  }});

export default i18n;"""
    
    def _create_i18n_provider(self) -> str:
        """Create i18n provider component."""
        return """import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../lib/i18n';

const I18nProvider = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
};

export default I18nProvider;"""
