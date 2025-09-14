const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class LocaleTool extends BaseTool {
  async execute() {
    this.log('📝 Creating locale files...');
    
    // Get translation results from agent state
    const state = this.agent.stateManager.getState();
    const translateResults = state.context.translateResults || { translations: {} };
    const targetLanguage = state.targetLanguage || 'es';
    
    this.log(`  🔍 Debug: targetLanguage = ${targetLanguage}`);
    this.log(`  🔍 Debug: translateResults = ${JSON.stringify(translateResults, null, 2)}`);
    
    const results = {
      localeFilesCreated: 0,
      files: {}
    };
    
    // Create locale directory if it doesn't exist
    const localeDir = path.join(process.cwd(), 'locales', targetLanguage);
    this.log(`  🔍 Debug: localeDir = ${localeDir}`);
    
    if (!fs.existsSync(localeDir)) {
      this.log(`  📁 Creating locale directory: ${localeDir}`);
      fs.mkdirSync(localeDir, { recursive: true });
    }
    
    // Create Spanish common.json file
    const spanishFile = path.join(localeDir, 'common.json');
    const spanishTranslations = this.buildCommonTranslations(translateResults.translations);
    
    this.log(`  🔍 Debug: Writing Spanish common.json to: ${spanishFile}`);
    this.log(`  🔍 Debug: Spanish translations: ${JSON.stringify(spanishTranslations, null, 2)}`);
    
    try {
      fs.writeFileSync(spanishFile, JSON.stringify(spanishTranslations, null, 2));
      this.log(`  ✅ Successfully wrote Spanish common.json`);
      results.localeFilesCreated++;
      results.files[spanishFile] = Object.keys(spanishTranslations).length;
    } catch (error) {
      this.log(`  ❌ Failed to write Spanish common.json: ${error.message}`);
      throw error;
    }
    
    // Create English common.json file
    const englishDir = path.join(process.cwd(), 'locales', 'en');
    if (!fs.existsSync(englishDir)) {
      this.log(`  📁 Creating English locale directory: ${englishDir}`);
      fs.mkdirSync(englishDir, { recursive: true });
    }
    
    const englishFile = path.join(englishDir, 'common.json');
    const englishTranslations = this.buildEnglishTranslations(translateResults.translations);
    
    this.log(`  🔍 Debug: Writing English common.json to: ${englishFile}`);
    this.log(`  🔍 Debug: English translations: ${JSON.stringify(englishTranslations, null, 2)}`);
    
    try {
      fs.writeFileSync(englishFile, JSON.stringify(englishTranslations, null, 2));
      this.log(`  ✅ Successfully wrote English common.json`);
      results.localeFilesCreated++;
      results.files[englishFile] = Object.keys(englishTranslations).length;
    } catch (error) {
      this.log(`  ❌ Failed to write English common.json: ${error.message}`);
      throw error;
    }
    
    // Create namespace files if needed
    const namespaceFiles = this.createNamespaceFiles(translateResults.translations, localeDir);
    results.localeFilesCreated += Object.keys(namespaceFiles).length;
    Object.assign(results.files, namespaceFiles);
    
    // Store results in agent state
    this.agent.stateManager.updateContext({ localeResults: results });
    
    this.log(`  🔍 Debug: results.localeFilesCreated = ${results.localeFilesCreated}`);
    this.log(`  🔍 Debug: results.files = ${JSON.stringify(results.files, null, 2)}`);
    
    // Update phase to indicate locale creation is complete
    if (results.localeFilesCreated > 0) {
      this.agent.stateManager.updateState({ phase: 'locale_complete' });
      this.log(`  ✅ Locale phase complete - ${results.localeFilesCreated} files created`);
    } else {
      this.log(`  ⚠️ No locale files were created (localeFilesCreated = ${results.localeFilesCreated})`);
    }
    
    return results;
  }
  
  buildCommonTranslations(translations) {
    this.log(`  🔍 Debug: buildCommonTranslations called with: ${JSON.stringify(translations, null, 2)}`);
    
    const common = {};
    
    // Handle array of translations (from TranslateTool)
    if (Array.isArray(translations)) {
      translations.forEach(translation => {
        if (translation.key && translation.translation) {
          common[translation.key] = translation.translation;
        }
      });
    } else if (translations && typeof translations === 'object') {
      // Handle object format (legacy)
      Object.values(translations).forEach(categoryTranslations => {
        if (Array.isArray(categoryTranslations)) {
          categoryTranslations.forEach(translation => {
            if (translation.key && translation.translation) {
              common[translation.key] = translation.translation;
            }
          });
        }
      });
    }
    
    this.log(`  🔍 Debug: built common translations: ${JSON.stringify(common, null, 2)}`);
    return common;
  }
  
  buildEnglishTranslations(translations) {
    this.log(`  🔍 Debug: buildEnglishTranslations called with: ${JSON.stringify(translations, null, 2)}`);
    
    const english = {};
    
    // Handle array of translations (from TranslateTool)
    if (Array.isArray(translations)) {
      translations.forEach(translation => {
        if (translation.key && translation.text) {
          english[translation.key] = translation.text; // Use original English text
        }
      });
    } else if (translations && typeof translations === 'object') {
      // Handle object format (legacy)
      Object.values(translations).forEach(categoryTranslations => {
        if (Array.isArray(categoryTranslations)) {
          categoryTranslations.forEach(translation => {
            if (translation.key && translation.text) {
              english[translation.key] = translation.text; // Use original English text
            }
          });
        }
      });
    }
    
    this.log(`  🔍 Debug: built English translations: ${JSON.stringify(english, null, 2)}`);
    return english;
  }
  
  createNamespaceFiles(translations, localeDir) {
    const namespaceFiles = {};
    
    // Create separate files for different categories if they have many strings
    Object.entries(translations).forEach(([category, strings]) => {
      if (strings.length > 5) { // Only create separate files for categories with many strings
        const fileName = `${category}.json`;
        const filePath = path.join(localeDir, fileName);
        
        const categoryTranslations = {};
        strings.forEach(translation => {
          categoryTranslations[translation.key] = translation.translation;
        });
        
        fs.writeFileSync(filePath, JSON.stringify(categoryTranslations, null, 2));
        namespaceFiles[filePath] = strings.length;
      }
    });
    
    return namespaceFiles;
  }
}

module.exports = LocaleTool;
