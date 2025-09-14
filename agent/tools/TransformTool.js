const fs = require('fs');
const path = require('path');
const BaseTool = require('./BaseTool');

class TransformTool extends BaseTool {
  async execute() {
    this.log('🛠️ Transforming files to use t() calls...');
    
    // Get analysis results from agent state
    const analysisResults = this.agent.stateManager.getState().context.analysisResults || { files: {} };
    
    const results = {
      filesTransformed: 0,
      files: {}
    };
    
    // Process files
    for (const [filePath, fileAnalysis] of Object.entries(analysisResults.files)) {
      if (fileAnalysis.strings && fileAnalysis.strings.length > 0) {
        try {
          this.log(`  📄 Transforming ${filePath}...`);
          const transformResult = await this.transformFile(filePath, fileAnalysis);
          if (transformResult.success) {
            results.filesTransformed++;
            results.files[filePath] = transformResult;
            this.log(`  ✅ Successfully transformed ${filePath}`);
          } else {
            this.log(`  ❌ Failed to transform ${filePath}: ${transformResult.error}`);
          }
        } catch (error) {
          this.error(`Failed to transform ${filePath}: ${error.message}`);
          results.files[filePath] = { success: false, error: error.message };
        }
      }
    }
    
    // Store results in agent state
    this.agent.stateManager.updateContext({ transformResults: results });
    
    // Update phase to indicate transformation is complete
    if (results.filesTransformed > 0) {
      this.agent.stateManager.updateState({ phase: 'transforming_complete' });
      this.log(`  ✅ Transformation phase complete - ${results.filesTransformed} files transformed`);
    }
    
    return results;
  }
  
  async transformFile(filePath, fileAnalysis) {
    this.log(`  🔍 TransformFile called with filePath: ${filePath}`);
    this.log(`  🔍 FileAnalysis: ${JSON.stringify(fileAnalysis, null, 2)}`);
    
    if (!filePath) {
      this.log(`  ❌ filePath is undefined!`);
      return { success: false, error: 'File path is undefined' };
    }
    
    if (!fs.existsSync(filePath)) {
      this.log(`  ❌ File not found: ${filePath}`);
      return { success: false, error: 'File not found' };
    }
    
    this.log(`  📄 Reading file: ${filePath}`);
    const originalContent = fs.readFileSync(filePath, 'utf8');
    this.log(`  📄 File content length: ${originalContent.length} characters`);
    
    // Create backup
    this.log(`  💾 Creating backup...`);
    await this.createBackup(filePath, originalContent);
    
    // Ask Claude to transform the file
    this.log(`  🤖 Calling Claude to transform...`);
    const updatedContent = await this.askClaudeToTransform(filePath, originalContent, fileAnalysis);
    
    this.log(`  📥 Claude response received, length: ${updatedContent ? updatedContent.length : 'undefined'}`);
    
    if (updatedContent && updatedContent !== originalContent) {
      // Save the updated file
      this.log(`  💾 Saving transformed file...`);
      fs.writeFileSync(filePath, updatedContent);
      
      this.log(`  ✅ File transformed successfully`);
      return {
        success: true,
        changes: this.countChanges(originalContent, updatedContent),
        originalLength: originalContent.length,
        updatedLength: updatedContent.length
      };
    }
    
    // Check if file is already internationalized
    if (originalContent.includes('useTranslation') && originalContent.includes('t(')) {
      this.log(`  ✅ File already internationalized - no changes needed`);
      return {
        success: true,
        changes: 0,
        originalLength: originalContent.length,
        updatedLength: originalContent.length,
        alreadyTransformed: true
      };
    }
    
    this.log(`  ⚠️ No changes made or Claude returned original content`);
    return { success: false, error: 'No changes made' };
  }
  
  async askClaudeToTransform(filePath, content, fileAnalysis) {
    const strings = fileAnalysis.strings || [];
    
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

STRINGS TO TRANSLATE:
${strings.map(s => `- "${s.text}" → t('${s.key}')`).join('\n')}

CURRENT CONTENT:
\`\`\`jsx
${content}
\`\`\`

Please return the updated file content with i18n translations applied. Make sure to:
- Add the useTranslation import at the top
- Replace hardcoded strings with t('key') calls using the provided keys
- Maintain all existing functionality

Return ONLY the updated file content, no explanations.`;

    try {
      this.log(`  🤖 Calling Claude to transform ${filePath}...`);
      this.log(`  📝 Prompt length: ${prompt.length} characters`);
      
      const result = await this.askClaude(prompt, 8000);
      
      this.log(`  📥 Claude response received`);
      this.log(`  📄 Response length: ${result.length} characters`);
      this.log(`  📄 Response preview: ${result.substring(0, 200)}...`);
      
      // Extract code from markdown code blocks if present
      const extractedCode = this.extractCodeFromMarkdown(result);
      this.log(`  🔍 Extracted code length: ${extractedCode.length} characters`);
      
      return extractedCode;
    } catch (error) {
      this.error(`Claude API error for ${filePath}: ${error.message}`);
      return content; // Return original content if Claude fails
    }
  }
  
  extractCodeFromMarkdown(response) {
    // Look for code blocks with jsx, js, tsx, or ts language
    const codeBlockRegex = /```(?:jsx|js|tsx|ts|javascript|typescript)?\s*\n([\s\S]*?)\n```/;
    const match = response.match(codeBlockRegex);
    
    if (match && match[1]) {
      this.log(`  🔍 Found code block, extracting content...`);
      return match[1].trim();
    }
    
    // If no code block found, return the response as-is
    this.log(`  🔍 No code block found, using response as-is`);
    return response.trim();
  }

  async createBackup(filePath, content) {
    this.log(`  💾 Creating backup for: ${filePath}`);
    this.log(`  💾 Agent backupDir: ${this.agent.backupDir}`);
    
    if (!this.agent.backupDir) {
      this.log(`  ❌ Agent backupDir is undefined!`);
      throw new Error('Agent backupDir is undefined');
    }
    
    const backupPath = path.join(this.agent.backupDir, filePath);
    this.log(`  💾 Backup path: ${backupPath}`);
    
    const backupDir = path.dirname(backupPath);
    this.log(`  💾 Backup directory: ${backupDir}`);
    
    if (!fs.existsSync(backupDir)) {
      this.log(`  💾 Creating backup directory: ${backupDir}`);
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    this.log(`  💾 Writing backup file...`);
    fs.writeFileSync(backupPath, content);
    this.log(`  💾 Backup created successfully`);
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
