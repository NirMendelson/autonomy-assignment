const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');
const OpenAI = require('openai');

class SearchTool extends BaseTool {
  constructor(agent) {
    super(agent);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async execute() {
    this.log('🔍 Searching for hardcoded strings...');
    
    // Get files from agent's memory/state
    let targets = this.agent.stateManager.getState().context.filesToProcess;
    
    // If no files in memory, discover them
    if (!targets || targets.length === 0) {
      this.log('  📁 No files in memory, discovering JSX files...');
      targets = await this.discoverJSXFiles();
      
      // Store files in agent's memory
      this.agent.stateManager.updateContext({
        filesToProcess: targets
      });
      
      this.log(`  🧠 Stored ${targets.length} files in agent memory`);
    } else {
      this.log(`  🧠 Using ${targets.length} files from agent memory`);
    }
    
    const results = {
      totalStrings: 0,
      filesWithStrings: 0,
      files: {}
    };
    
    for (const filePath of targets) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const strings = await this.findHardcodedStringsWithGPT(content, filePath);
        
        if (strings.length > 0) {
          results.filesWithStrings++;
          results.totalStrings += strings.length;
          results.files[filePath] = {
            strings: strings,
            count: strings.length
          };
        }
      }
    }
    
    return results;
  }
  
  async findHardcodedStringsWithGPT(content, filePath) {
    try {
      const prompt = `Find user-facing text in this React file. Return JSON with phrases array.

Rules:
- Include button text, links, labels, messages users see
- Exclude HTML IDs, CSS classes, code logic
- Generate semantic keys like "button.save", "menu.my_books"
- Return only valid JSON: {"phrases": [{"text": "original", "key": "semantic.key"}]}

File: ${filePath}

\`\`\`jsx
${content}
\`\`\``;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Convert to our format
      return result.phrases.map(phrase => ({
        text: phrase.text,
        key: phrase.key,
        line: this.findLineNumber(content, phrase.text),
        context: this.findContext(content, phrase.text)
      }));

    } catch (error) {
      this.log(`  ❌ GPT analysis failed for ${filePath}: ${error.message}`);
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
  
  isTranslatable(text) {
    // Skip very short strings, numbers, variables, etc.
    if (text.length < 2) return false;
    if (/^\d+$/.test(text)) return false;
    if (/^[A-Z_]+$/.test(text)) return false; // Constants
    if (text.includes('${') || text.includes('{{')) return false; // Template literals
    if (text.startsWith('/') && text.includes('/')) return false; // Routes
    if (text.includes('className') || text.includes('id=')) return false; // HTML attributes
    
    // Skip CSS values and HTML attributes
    if (['row', 'column', 'center', 'space-around', 'space-between', 'flex-start', 'flex-end'].includes(text)) return false;
    if (['true', 'false', 'auto', 'none', 'block', 'inline', 'flex'].includes(text)) return false;
    if (text.includes('-') && !text.includes(' ')) return false; // CSS classes and IDs
    if (text.match(/^[a-z-]+$/)) return false; // CSS values like "simple-menu"
    
    // Skip HTML IDs and technical identifiers
    if (text.includes('menu') && text.includes('-')) return false; // "simple-menu", "wrappingLink"
    if (text.includes('snackbar') || text.includes('message')) return false; // Technical IDs
    
    return true;
  }
  
  async discoverJSXFiles() {
    const jsxFiles = [];
    
    // Check if we're in test mode (only search test-i18n folder)
    const searchDirs = this.agent.testMode ? ['test-i18n'] : [
      'components',
      'pages', 
      'src'
    ];
    
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = this.findJSXFilesInDir(dir);
        jsxFiles.push(...files);
      }
    }
    
    this.log(`  📁 Discovered ${jsxFiles.length} JSX files: ${jsxFiles.join(', ')}`);
    return jsxFiles;
  }
  
  findJSXFilesInDir(dir, basePath = '') {
    const files = [];
    const fullPath = basePath ? `${basePath}/${dir}` : dir;
    
    if (!fs.existsSync(fullPath)) return files;
    
    const items = fs.readdirSync(fullPath);
    
    for (const item of items) {
      const itemPath = `${fullPath}/${item}`;
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = this.findJSXFilesInDir(item, fullPath);
        files.push(...subFiles);
      } else if (stat.isFile() && (item.endsWith('.jsx') || item.endsWith('.js'))) {
        // Check if it's a React component (contains JSX)
        try {
          const content = fs.readFileSync(itemPath, 'utf8');
          if (this.isReactComponent(content)) {
            files.push(itemPath);
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }
    
    return files;
  }
  
  isReactComponent(content) {
    // Check for JSX syntax patterns
    const jsxPatterns = [
      /<[A-Z][a-zA-Z0-9]*/,  // JSX element starting with capital letter
      /<[a-z][a-zA-Z0-9]*/,  // JSX element starting with lowercase
      /<\/[A-Za-z]/,         // Closing JSX element
      /className\s*=/,       // className attribute
      /onClick\s*=/,         // onClick attribute
      /return\s*\(/,         // return statement with parentheses
      /import.*from.*['"]react['"]/  // React import
    ];
    
    return jsxPatterns.some(pattern => pattern.test(content));
  }
  
}

module.exports = SearchTool;
