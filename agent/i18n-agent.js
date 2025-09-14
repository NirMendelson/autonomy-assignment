require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

class I18nAgent {
  constructor() {
    this.targetsFile = '.i18n-agent/targets.json';
    this.backupDir = '.i18n-agent/backup';
    this.processedFiles = [];
    this.changes = [];
  }

  async processAllFiles() {
    console.log('🤖 Starting I18n Agent with Claude Sonnet 4...\n');
    
    // Load target files
    if (!fs.existsSync(this.targetsFile)) {
      console.error('❌ Targets file not found. Run "npm run i18n:decide-targets" first.');
      process.exit(1);
    }
    
    const targets = JSON.parse(fs.readFileSync(this.targetsFile, 'utf8'));
    console.log(`📋 Processing ${targets.length} target files...\n`);
    
    // Process each file
    for (let i = 0; i < targets.length; i++) {
      const filePath = targets[i];
      console.log(`\n📄 [${i + 1}/${targets.length}] Processing ${filePath}...`);
      
      try {
        await this.processFile(filePath);
        this.processedFiles.push(filePath);
      } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
      }
    }
    
    this.generateReport();
  }

  async processFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  File not found: ${filePath}`);
      return;
    }

    const originalContent = fs.readFileSync(filePath, 'utf8');
    
    // Create backup
    await this.createBackup(filePath, originalContent);
    
    // Ask Claude to analyze and update the file
    const updatedContent = await this.askClaudeToUpdate(filePath, originalContent);
    
    if (updatedContent && updatedContent !== originalContent) {
      // Save the updated file
      fs.writeFileSync(filePath, updatedContent);
      console.log(`✅ Updated ${filePath}`);
      
      // Track changes
      this.changes.push({
        file: filePath,
        originalLength: originalContent.length,
        updatedLength: updatedContent.length,
        changes: this.countChanges(originalContent, updatedContent)
      });
    } else {
      console.log(`📝 No changes needed for ${filePath}`);
    }
  }

  async askClaudeToUpdate(filePath, content) {
    const prompt = `You are an expert React/Next.js internationalization specialist. 

TASK: Update this file to use i18n translation keys instead of hardcoded strings.

RULES:
1. Replace hardcoded user-facing strings with t('key') calls
2. Import useTranslation hook if not already imported
3. Add semantic translation keys (e.g., 'button.save', 'menu.my_books')
4. Only translate strings visible to end users (buttons, labels, messages, etc.)
5. Do NOT translate: HTML IDs, CSS classes, console.log messages, route paths, technical identifiers
6. Preserve all code functionality and formatting
7. Use proper JSX syntax and React patterns

FILE: ${filePath}

CURRENT CONTENT:
\`\`\`jsx
${content}
\`\`\`

Please return the updated file content with i18n translations applied. Make sure to:
- Add the useTranslation import at the top
- Replace hardcoded strings with t('key') calls
- Use semantic, descriptive keys
- Maintain all existing functionality

Return ONLY the updated file content, no explanations.`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      console.error(`❌ Claude API error for ${filePath}:`, error.message);
      return content; // Return original content if Claude fails
    }
  }

  async createBackup(filePath, content) {
    const backupPath = path.join(this.backupDir, filePath);
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

  generateReport() {
    console.log('\n🎉 I18n Agent Complete!');
    console.log(`📊 Processed ${this.processedFiles.length} files`);
    console.log(`📝 Made changes to ${this.changes.length} files`);
    
    if (this.changes.length > 0) {
      console.log('\n📋 Files Updated:');
      this.changes.forEach(change => {
        console.log(`  ✅ ${change.file} (${change.changes} changes)`);
      });
    }
    
    console.log('\n💾 Backups saved to:', this.backupDir);
    console.log('\n🔍 Next steps:');
    console.log('  1. Review the changes');
    console.log('  2. Add translation keys to locales/en/common.json');
    console.log('  3. Test the application');
    console.log('  4. Run "npm run i18n:restore" if you need to revert');
  }
}

// Run the agent
async function main() {
  const agent = new I18nAgent();
  await agent.processAllFiles();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = I18nAgent;
