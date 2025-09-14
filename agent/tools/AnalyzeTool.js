const fs = require('fs');
const BaseTool = require('./BaseTool');
const OpenAI = require('openai');

class AnalyzeTool extends BaseTool {
  constructor(agent) {
    super(agent);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async execute() {
    this.log('📊 Analyzing files for hardcoded strings...');
    
    // Get files from agent's memory/state
    const state = this.agent.stateManager.getState();
    const files = state.context.filesToProcess || [];
    
    this.log(`  🧠 Retrieved files from memory: ${JSON.stringify(files)}`);
    this.log(`  🧠 Files type: ${typeof files}, length: ${files.length}`);
    
    if (files.length === 0) {
      this.log('  ❌ No files to analyze');
      return { filesAnalyzed: 0, stringsFound: 0, files: {} };
    }
    
    const analysisResults = {
      filesAnalyzed: 0,
      stringsFound: 0,
      files: {}
    };
    
    for (const filePath of files) {
      if (fs.existsSync(filePath)) {
        this.log(`  📄 Analyzing ${filePath}...`);
        const content = fs.readFileSync(filePath, 'utf8');
        this.log(`  📄 File content length: ${content.length} characters`);
        this.log(`  📄 File content preview: ${content.substring(0, 300)}...`);
        
        const strings = await this.findHardcodedStringsWithGPT(content, filePath);
        
        this.log(`  📊 Analysis complete for ${filePath}: ${strings.length} strings found`);
        
        if (strings.length > 0) {
          analysisResults.filesAnalyzed++;
          analysisResults.stringsFound += strings.length;
          analysisResults.files[filePath] = {
            strings: strings,
            count: strings.length,
            complexity: this.calculateComplexity(strings),
            needsUseTranslation: !content.includes('useTranslation'),
            hasI18nSetup: content.includes('next-i18next') || content.includes('react-i18next')
          };
          
          this.log(`  📝 Found ${strings.length} strings in ${filePath}`);
          this.log(`  📝 Strings: ${strings.map(s => s.text).join(', ')}`);
        } else {
          this.log(`  ⚠️ No strings found in ${filePath}`);
        }
      } else {
        this.log(`  ❌ File not found: ${filePath}`);
      }
    }
    
    // Store results in agent state and update phase
    this.agent.stateManager.updateContext({ 
      stringsFound: analysisResults.stringsFound,
      analysisResults: analysisResults 
    });
    
    this.agent.stateManager.updateState({
      phase: 'analyzing'
    });
    
    return analysisResults;
  }

  async findHardcodedStringsWithGPT(content, filePath) {
    try {
      this.log(`  🤖 Calling GPT for ${filePath}...`);
      
      const prompt = `Find ALL user-facing text in this React file. Return JSON with phrases array.

INCLUDE:
- Button text content
- Link text content  
- Label text content
- Alt text (alt="...")
- Placeholder text (placeholder="...")
- Aria labels (aria-label="...")
- Title attributes (title="...")
- Any visible text users see
- Error messages, notifications, tooltips
- Form labels and help text

EXCLUDE:
- HTML IDs, CSS classes, variable names
- Code logic, function names
- URLs, file paths, technical values
- Comments and console.log statements

Generate semantic keys like "button.save", "menu.my_books", "alt.logo", "placeholder.email"

Return only valid JSON: {"phrases": [{"text": "original", "key": "semantic.key"}]}

File: ${filePath}

\`\`\`jsx
${content}
\`\`\``;

      this.log(`  📝 Prompt length: ${prompt.length} characters`);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      this.log(`  📥 GPT response received`);
      
      let responseText = response.choices[0].message.content;
      this.log(`  📄 Raw response length: ${responseText.length} characters`);
      this.log(`  📄 Raw response preview: ${responseText.substring(0, 200)}...`);
      
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        responseText = jsonMatch[1];
        this.log(`  🔍 Extracted JSON from markdown`);
      } else {
        this.log(`  🔍 No markdown code blocks found, using raw response`);
      }
      
      this.log(`  📄 Final JSON length: ${responseText.length} characters`);
      this.log(`  📄 Final JSON preview: ${responseText.substring(0, 200)}...`);
      
      const result = JSON.parse(responseText);
      this.log(`  ✅ JSON parsed successfully`);
      this.log(`  📊 Found ${result.phrases ? result.phrases.length : 0} phrases`);
      
      if (result.phrases && result.phrases.length > 0) {
        this.log(`  📝 Phrases: ${result.phrases.map(p => p.text).join(', ')}`);
      }
      
      // Convert to our format
      return result.phrases.map(phrase => ({
        text: phrase.text,
        key: phrase.key,
        line: this.findLineNumber(content, phrase.text),
        context: this.findContext(content, phrase.text)
      }));

    } catch (error) {
      this.log(`  ❌ GPT analysis failed for ${filePath}: ${error.message}`);
      this.log(`  🔍 Error details: ${error.stack}`);
      return [];
    }
  }

  findLineNumber(content, text) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(text)) {
        return i + 1;
      }
    }
    return 1;
  }

  findContext(content, text) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(text)) {
        return lines[i].trim();
      }
    }
    return '';
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
