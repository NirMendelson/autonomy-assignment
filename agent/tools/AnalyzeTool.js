const fs = require('fs');
const BaseTool = require('./BaseTool');

class AnalyzeTool extends BaseTool {
  async execute() {
    this.log('📊 Analyzing files for translation needs...');
    
    // Get search results from the agent's state
    const searchResults = this.agent.searchResults || { files: {} };
    const analysisResults = {
      filesAnalyzed: 0,
      files: {},
      totalComplexity: 0
    };
    
    for (const [filePath, fileData] of Object.entries(searchResults.files)) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const analysis = await this.analyzeFile(filePath, content, fileData.strings);
        
        analysisResults.filesAnalyzed++;
        analysisResults.files[filePath] = analysis;
        analysisResults.totalComplexity += analysis.complexity;
      }
    }
    
    // Store results in agent state
    this.agent.analysisResults = analysisResults;
    
    return analysisResults;
  }
  
  async analyzeFile(filePath, content, strings) {
    const         analysis = {
          filePath: filePath,
          strings: strings,
          complexity: this.calculateComplexity(strings),
          needsUseTranslation: !content.includes('useTranslation'),
          hasI18nSetup: content.includes('next-i18next') || content.includes('react-i18next'),
          suggestedKeys: this.generateSuggestedKeys(strings),
          priority: this.calculatePriority(strings, content, filePath)
        };
    
    return analysis;
  }
  
  calculateComplexity(strings) {
    // Simple complexity calculation based on string count and types
    let complexity = strings.length;
    
    // Add complexity for different string types
    const typeWeights = {
      'jsx-text': 1,
      'button-text': 2,
      'notify-message': 3,
      'jsx-attr': 1,
      'link-text': 2,
      'label-text': 2
    };
    
    strings.forEach(string => {
      complexity += typeWeights[string.type] || 1;
    });
    
    return complexity;
  }
  
  generateSuggestedKeys(strings) {
    const keys = [];
    
    strings.forEach(string => {
      const key = this.stringToKey(string.text, string.type);
      keys.push({
        original: string.text,
        suggested: key,
        type: string.type
      });
    });
    
    return keys;
  }
  
  stringToKey(text, type) {
    // Convert string to semantic key
    let key = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 30); // Limit length
    
    // Add type prefix
    const typePrefixes = {
      'button-text': 'button',
      'notify-message': 'notification',
      'link-text': 'link',
      'label-text': 'label',
      'jsx-text': 'text',
      'jsx-attr': 'attr'
    };
    
    const prefix = typePrefixes[type] || 'text';
    return `${prefix}.${key}`;
  }
  
  calculatePriority(strings, content, filePath) {
    // Calculate priority based on file importance and string count
    let priority = strings.length;
    
    // Higher priority for important files
    if (filePath.includes('Header') || filePath.includes('Menu')) priority += 10;
    if (filePath.includes('pages/')) priority += 5;
    if (filePath.includes('components/')) priority += 3;
    
    // Higher priority for files with many strings
    if (strings.length > 5) priority += 5;
    if (strings.length > 10) priority += 10;
    
    return priority;
  }
}

module.exports = AnalyzeTool;
