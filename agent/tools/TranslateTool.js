const BaseTool = require('./BaseTool');

class TranslateTool extends BaseTool {
  async execute() {
    const targetLanguage = this.agent.stateManager.getState().targetLanguage || 'es';
    this.log(`🌐 Translating strings to ${targetLanguage.toUpperCase()}...`);
    
    // Get analysis results from agent state
    const analysisResults = this.agent.stateManager.getState().context.analysisResults || { files: {} };
    
    const results = {
      stringsTranslated: 0,
      translations: {}
    };
    
    // Collect all strings from analysis results
    const allStrings = [];
    for (const [filePath, fileData] of Object.entries(analysisResults.files)) {
      if (fileData.strings && fileData.strings.length > 0) {
        allStrings.push(...fileData.strings);
      }
    }
    
    if (allStrings.length > 0) {
      this.log(`  📝 Found ${allStrings.length} strings to translate`);
      const translations = await this.translateStrings(allStrings, targetLanguage);
      results.translations = translations;
      results.stringsTranslated = translations.length;
    } else {
      this.log(`  ⚠️ No strings found to translate`);
    }
    
    // Store results in agent state
    this.agent.stateManager.updateContext({ translateResults: results });
    
    return results;
  }
  
  async translateStrings(strings, targetLanguage) {
    const prompt = `You are a professional translator specializing in software localization.

TASK: Translate the following strings from English to ${this.getLanguageName(targetLanguage)}.

CONTEXT: These are user interface strings for a React/Next.js application.

TRANSLATION GUIDELINES:
1. Maintain the same tone and style as the original
2. Keep technical terms consistent
3. Preserve any special characters or formatting
4. Make translations natural and user-friendly
5. Keep button text concise and action-oriented
6. Ensure labels are clear and descriptive

STRINGS TO TRANSLATE:
${strings.map(s => `- "${s.text}" (key: ${s.key})`).join('\n')}

Please respond with ONLY the translations in this exact format:
key: "translated_text"
key: "translated_text"
...`;

    try {
      const response = await this.askClaude(prompt, 4000);
      return this.parseTranslations(response, strings);
    } catch (error) {
      this.error(`Translation failed: ${error.message}`);
      return strings.map(s => ({ ...s, translation: s.text })); // Fallback to original
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
          translation: string.text
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
