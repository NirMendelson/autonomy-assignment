const BaseTool = require('./BaseTool');

class TranslateTool extends BaseTool {
  async execute() {
    this.log(`🌐 Translating strings to ${this.agent.targetLanguage.toUpperCase()}...`);
    
    // Get organized results from agent state
    const organizeResults = this.agent.organizeResults || { categories: {} };
    
    const results = {
      stringsTranslated: 0,
      translations: {}
    };
    
    // Translate each category
    for (const [category, strings] of Object.entries(organizeResults.categories)) {
      if (strings.length > 0) {
        const translations = await this.translateCategory(category, strings);
        results.translations[category] = translations;
        results.stringsTranslated += translations.length;
      }
    }
    
    // Store results in agent state
    this.agent.translateResults = results;
    
    return results;
  }
  
  async translateCategory(category, strings) {
    const translations = [];
    
    // Group strings for batch translation
    const batchSize = 10;
    for (let i = 0; i < strings.length; i += batchSize) {
      const batch = strings.slice(i, i + batchSize);
      const batchTranslations = await this.translateBatch(category, batch);
      translations.push(...batchTranslations);
    }
    
    return translations;
  }
  
  async translateBatch(category, strings) {
    const prompt = `You are a professional translator specializing in software localization.

TASK: Translate the following ${category} strings from English to ${this.getLanguageName(this.agent.targetLanguage)}.

CONTEXT: These are user interface strings for a React/Next.js application.

TRANSLATION GUIDELINES:
1. Maintain the same tone and style as the original
2. Keep technical terms consistent
3. Preserve any special characters or formatting
4. Make translations natural and user-friendly
5. Keep button text concise and action-oriented
6. Ensure labels are clear and descriptive

STRINGS TO TRANSLATE:
${strings.map(s => `- "${s.original}" (key: ${s.key})`).join('\n')}

Please respond with ONLY the translations in this exact format:
key: "translated_text"
key: "translated_text"
...`;

    try {
      const response = await this.askClaude(prompt, 4000);
      return this.parseTranslations(response, strings);
    } catch (error) {
      this.error(`Translation failed for ${category}: ${error.message}`);
      return strings.map(s => ({ ...s, translation: s.original })); // Fallback to original
    }
  }
  
  parseTranslations(response, strings) {
    const translations = [];
    const lines = response.split('\n');
    
    strings.forEach(string => {
      const key = string.key;
      const translationLine = lines.find(line => line.startsWith(`${key}:`));
      
      if (translationLine) {
        const translation = translationLine.split(':', 2)[1].trim().replace(/^["']|["']$/g, '');
        translations.push({
          ...string,
          translation: translation
        });
      } else {
        // Fallback to original if translation not found
        translations.push({
          ...string,
          translation: string.original
        });
      }
    });
    
    return translations;
  }
  
  getLanguageName(code) {
    const languages = {
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
    };
    
    return languages[code] || code.toUpperCase();
  }
}

module.exports = TranslateTool;
