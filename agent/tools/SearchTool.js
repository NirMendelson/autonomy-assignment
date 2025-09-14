const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class SearchTool extends BaseTool {

  async execute() {
    this.log('🔍 Discovering React files...');
    
    // Get files from agent's memory/state
    let targets = this.agent.stateManager.getState().context.filesToProcess;
    
    // If no files in memory, discover them
    if (!targets || targets.length === 0) {
      this.log('  📁 No files in memory, discovering JSX files...');
      targets = await this.discoverJSXFiles();
      
    // Store files in agent's memory and update phase
    this.agent.stateManager.updateContext({
      filesToProcess: targets
    });
    
    this.agent.stateManager.updateState({
      phase: 'searching'
    });
    
    this.log(`  🧠 Stored ${targets.length} files in agent memory`);
    this.log(`  🧠 Files stored: ${JSON.stringify(targets)}`);
    } else {
      this.log(`  🧠 Using ${targets.length} files from agent memory`);
    }
    
    return {
      filesDiscovered: targets.length,
      files: targets
    };
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
