const BaseTool = require('./BaseTool');

class OrganizeTool extends BaseTool {
  async execute() {
    this.log('🗂️ Organizing strings into categories...');
    
    // Get analysis results from agent state
    const analysisResults = this.agent.analysisResults || { files: {} };
    
    const categories = {
      buttons: [],
      labels: [],
      messages: [],
      links: [],
      text: [],
      notifications: []
    };
    
    // Organize strings by category
    for (const [filePath, fileAnalysis] of Object.entries(analysisResults.files)) {
      fileAnalysis.suggestedKeys.forEach(keyData => {
        const category = this.categorizeKey(keyData.suggested);
        if (categories[category]) {
          categories[category].push({
            file: filePath,
            original: keyData.original,
            key: keyData.suggested,
            type: keyData.type
          });
        }
      });
    }
    
    // Generate key naming suggestions
    const keySuggestions = this.generateKeySuggestions(categories);
    
    const results = {
      categories: categories,
      keySuggestions: keySuggestions,
      totalStrings: Object.values(categories).reduce((sum, cat) => sum + cat.length, 0)
    };
    
    // Store results in agent state
    this.agent.organizeResults = results;
    
    return results;
  }
  
  categorizeKey(key) {
    if (key.startsWith('button.')) return 'buttons';
    if (key.startsWith('label.')) return 'labels';
    if (key.startsWith('notification.')) return 'notifications';
    if (key.startsWith('link.')) return 'links';
    if (key.startsWith('text.')) return 'text';
    return 'messages';
  }
  
  generateKeySuggestions(categories) {
    const suggestions = {};
    
    Object.entries(categories).forEach(([category, strings]) => {
      if (strings.length > 0) {
        suggestions[category] = {
          count: strings.length,
          examples: strings.slice(0, 3).map(s => s.key),
          namingPattern: this.suggestNamingPattern(strings)
        };
      }
    });
    
    return suggestions;
  }
  
  suggestNamingPattern(strings) {
    // Analyze strings to suggest naming patterns
    const patterns = {
      action: strings.filter(s => s.original.match(/^(Save|Edit|Delete|Add|Remove|Update)/i)).length,
      status: strings.filter(s => s.original.match(/^(Success|Error|Warning|Info)/i)).length,
      navigation: strings.filter(s => s.original.match(/^(Home|About|Contact|Login|Logout)/i)).length
    };
    
    const dominantPattern = Object.entries(patterns).reduce((a, b) => a[1] > b[1] ? a : b);
    
    return {
      type: dominantPattern[0],
      confidence: dominantPattern[1] / strings.length
    };
  }
}

module.exports = OrganizeTool;
