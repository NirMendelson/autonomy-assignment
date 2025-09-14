const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class SetupTool extends BaseTool {
  async execute() {
    this.log('⚙️ Setting up i18n configuration...');
    
    const state = this.agent.stateManager.getState();
    const targetLanguage = state.targetLanguage || 'es';
    
    const results = {
      configFilesCreated: 0,
      files: {}
    };
    
    // Create lib directory if it doesn't exist
    const libDir = path.join(process.cwd(), 'lib');
    if (!fs.existsSync(libDir)) {
      this.log(`  📁 Creating lib directory: ${libDir}`);
      fs.mkdirSync(libDir, { recursive: true });
    }
    
    // Create i18n configuration file
    const i18nConfig = this.createI18nConfig(targetLanguage);
    const i18nFile = path.join(libDir, 'i18n.js');
    
    this.log(`  🔍 Writing i18n config to: ${i18nFile}`);
    this.log(`  🔍 i18n config: ${JSON.stringify(i18nConfig, null, 2)}`);
    
    try {
      fs.writeFileSync(i18nFile, i18nConfig);
      this.log(`  ✅ Successfully wrote i18n.js`);
      results.configFilesCreated++;
      results.files[i18nFile] = 'i18n configuration';
    } catch (error) {
      this.log(`  ❌ Failed to write i18n.js: ${error.message}`);
      throw error;
    }
    
    // Create i18n provider component
    const providerComponent = this.createI18nProvider();
    const providerFile = path.join(process.cwd(), 'components', 'I18nProvider.jsx');
    
    // Create components directory if it doesn't exist
    const componentsDir = path.join(process.cwd(), 'components');
    if (!fs.existsSync(componentsDir)) {
      this.log(`  📁 Creating components directory: ${componentsDir}`);
      fs.mkdirSync(componentsDir, { recursive: true });
    }
    
    this.log(`  🔍 Writing I18nProvider to: ${providerFile}`);
    
    try {
      fs.writeFileSync(providerFile, providerComponent);
      this.log(`  ✅ Successfully wrote I18nProvider.jsx`);
      results.configFilesCreated++;
      results.files[providerFile] = 'i18n provider component';
    } catch (error) {
      this.log(`  ❌ Failed to write I18nProvider.jsx: ${error.message}`);
      throw error;
    }
    
    // Store results in agent state
    this.agent.stateManager.updateContext({ setupResults: results });
    
    // Update phase to indicate setup is complete
    if (results.configFilesCreated > 0) {
      this.agent.stateManager.updateState({ phase: 'setup_complete' });
      this.log(`  ✅ Setup phase complete - ${results.configFilesCreated} files created`);
    }
    
    return results;
  }
  
  createI18nConfig(targetLanguage) {
    return `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import locale files
import enCommon from '../locales/en/common.json';
import esCommon from '../locales/es/common.json';

const resources = {
  en: {
    common: enCommon
  },
  es: {
    common: esCommon
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: '${targetLanguage}', // Default language
    fallbackLng: 'en', // Fallback language
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    // Namespace configuration
    defaultNS: 'common',
    ns: ['common'],
    
    // Language detection
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    }
  });

export default i18n;`;
  }
  
  createI18nProvider() {
    return `import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../lib/i18n';

const I18nProvider = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
};

export default I18nProvider;`;
  }
}

module.exports = SetupTool;
