const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class TransformTool extends BaseTool {
  async execute() {
    this.log('🛠️ Transforming files to use t() calls...');
    
    // Get organized results from agent state
    const organizeResults = this.agent.organizeResults || { categories: {} };
    const analysisResults = this.agent.analysisResults || { files: {} };
    
    const results = {
      filesTransformed: 0,
      files: {}
    };
    
    // Process files in priority order
    const filesByPriority = Object.entries(analysisResults.files)
      .sort(([,a], [,b]) => b.priority - a.priority);
    
    for (const [filePath, fileAnalysis] of filesByPriority) {
      try {
        const transformResult = await this.transformFile(filePath, fileAnalysis);
        if (transformResult.success) {
          results.filesTransformed++;
          results.files[filePath] = transformResult;
        }
      } catch (error) {
        this.error(`Failed to transform ${filePath}: ${error.message}`);
        results.files[filePath] = { success: false, error: error.message };
      }
    }
    
    // Store results in agent state
    this.agent.transformResults = results;
    
    return results;
  }
  
  async transformFile(filePath, fileAnalysis) {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    const originalContent = fs.readFileSync(filePath, 'utf8');
    
    // Create backup
    await this.createBackup(filePath, originalContent);
    
    // Ask Claude to transform the file
    const updatedContent = await this.askClaudeToTransform(filePath, originalContent, fileAnalysis);
    
    if (updatedContent && updatedContent !== originalContent) {
      // Save the updated file
      fs.writeFileSync(filePath, updatedContent);
      
      return {
        success: true,
        changes: this.countChanges(originalContent, updatedContent),
        originalLength: originalContent.length,
        updatedLength: updatedContent.length
      };
    }
    
    return { success: false, error: 'No changes made' };
  }
  
  async askClaudeToTransform(filePath, content, fileAnalysis) {
    const prompt = `You are an expert React/Next.js internationalization specialist.

TASK: Transform this file to use i18n translation keys instead of hardcoded strings.

RULES:
1. Replace hardcoded user-facing strings with t('key') calls
2. Import useTranslation hook if not already imported
3. Use the suggested keys provided below
4. Only translate strings visible to end users (buttons, labels, messages, etc.)
5. Do NOT translate: HTML IDs, CSS classes, console.log messages, route paths, technical identifiers
6. Preserve all code functionality and formatting
7. Use proper JSX syntax and React patterns

FILE: ${filePath}

SUGGESTED KEYS:
${fileAnalysis.suggestedKeys.map(k => `- "${k.original}" → "${k.suggested}"`).join('\n')}

CURRENT CONTENT:
\`\`\`jsx
${content}
\`\`\`

Please return the updated file content with i18n translations applied. Make sure to:
- Add the useTranslation import at the top
- Replace hardcoded strings with t('key') calls using the suggested keys
- Maintain all existing functionality

Return ONLY the updated file content, no explanations.`;

    try {
      return await this.askClaude(prompt, 8000);
    } catch (error) {
      this.error(`Claude API error for ${filePath}: ${error.message}`);
      return content; // Return original content if Claude fails
    }
  }
  
  async createBackup(filePath, content) {
    const backupPath = path.join(this.agent.backupDir, filePath);
    const backupDir = path.dirname(backupPath);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    fs.writeFileSync(backupPath, content);
  }
  
  countChanges(original, updated) {
    const originalLines = original.split('\n');
    const updatedLines = updated.split('\n');
    
    let changes = 0;
    for (let i = 0; i < Math.max(originalLines.length, updatedLines.length); i++) {
      if (originalLines[i] !== updatedLines[i]) {
        changes++;
      }
    }
    
    return changes;
  }
}

module.exports = TransformTool;
