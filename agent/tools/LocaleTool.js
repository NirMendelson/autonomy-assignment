const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class LocaleTool extends BaseTool {
  async execute() {
    this.log('📝 Creating locale files...');
    
    // Get translation results from agent state
    const translateResults = this.agent.translateResults || { translations: {} };
    
    const results = {
      localeFilesCreated: 0,
      files: {}
    };
    
    // Create locale directory if it doesn't exist
    const localeDir = path.join(this.agent.localesDir, this.agent.targetLanguage);
    if (!fs.existsSync(localeDir)) {
      fs.mkdirSync(localeDir, { recursive: true });
    }
    
    // Create common.json file
    const commonFile = path.join(localeDir, 'common.json');
    const commonTranslations = this.buildCommonTranslations(translateResults.translations);
    
    fs.writeFileSync(commonFile, JSON.stringify(commonTranslations, null, 2));
    results.localeFilesCreated++;
    results.files[commonFile] = Object.keys(commonTranslations).length;
    
    // Create namespace files if needed
    const namespaceFiles = this.createNamespaceFiles(translateResults.translations, localeDir);
    results.localeFilesCreated += namespaceFiles.length;
    Object.assign(results.files, namespaceFiles);
    
    // Store results in agent state
    this.agent.localeResults = results;
    
    return results;
  }
  
  buildCommonTranslations(translations) {
    const common = {};
    
    // Flatten all translations into common.json
    Object.values(translations).forEach(categoryTranslations => {
      categoryTranslations.forEach(translation => {
        common[translation.key] = translation.translation;
      });
    });
    
    return common;
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
