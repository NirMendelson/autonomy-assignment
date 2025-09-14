const fs = require('fs');
const { exec } = require('child_process');
const BaseTool = require('./BaseTool');

class ValidateTool extends BaseTool {
  async execute() {
    this.log('✅ Validating i18n implementation...');
    
    // Get transform results from agent state
    const transformResults = this.agent.transformResults || { files: {} };
    
    const results = {
      validFiles: 0,
      invalidFiles: 0,
      files: {},
      issues: [],
      retryAttempts: 0,
      maxRetries: 3
    };
    
    // Validate each file with retry mechanism
    for (const [filePath, fileResult] of Object.entries(transformResults.files)) {
      if (fileResult.success) {
        const validation = await this.validateFileWithRetry(filePath, results.maxRetries);
        results.files[filePath] = validation;
        
        if (validation.isValid) {
          results.validFiles++;
        } else {
          results.invalidFiles++;
          results.issues.push(...validation.issues);
        }
      }
    }
    
    // Store results in agent state
    this.agent.validateResults = results;
    
    return results;
  }
  
  async validateFileWithRetry(filePath, maxRetries) {
    let lastValidation = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log(`  Validating ${filePath} (attempt ${attempt}/${maxRetries})...`);
      
      const validation = await this.validateFile(filePath);
      lastValidation = validation;
      
      if (validation.isValid) {
        this.success(`File ${filePath} is valid`);
        return validation;
      } else {
        this.error(`File ${filePath} has issues: ${validation.issues.join(', ')}`);
        
        if (attempt < maxRetries) {
          this.log(`  Attempting to fix issues in ${filePath}...`);
          const fixed = await this.attemptFix(filePath, validation.issues);
          if (fixed) {
            this.log(`  Fixed issues in ${filePath}, re-validating...`);
            continue;
          } else {
            this.error(`  Could not fix issues in ${filePath}`);
          }
        }
      }
    }
    
    // If we get here, all retries failed
    this.error(`File ${filePath} failed validation after ${maxRetries} attempts`);
    return {
      ...lastValidation,
      isValid: false,
      issues: [...(lastValidation?.issues || []), `Failed after ${maxRetries} retry attempts`]
    };
  }
  
  async validateFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return { isValid: false, issues: ['File not found'] };
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    // 1. Check for syntax errors first (most critical)
    const syntaxErrors = await this.checkSyntaxErrors(filePath, content);
    if (syntaxErrors.length > 0) {
      issues.push(...syntaxErrors);
      return { isValid: false, issues: issues, critical: true };
    }
    
    // 2. Check for useTranslation import
    if (!content.includes('useTranslation')) {
      issues.push('Missing useTranslation import');
    }
    
    // 3. Check for t() function usage
    if (!content.includes('t(')) {
      issues.push('No t() function calls found');
    }
    
    // 4. Check for hardcoded strings that should be translated
    const hardcodedStrings = this.findRemainingHardcodedStrings(content);
    if (hardcodedStrings.length > 0) {
      issues.push(`Found ${hardcodedStrings.length} remaining hardcoded strings`);
    }
    
    // 5. Check for proper i18n setup
    const i18nIssues = this.checkI18nSetup(content);
    if (i18nIssues.length > 0) {
      issues.push(...i18nIssues);
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      hardcodedStrings: hardcodedStrings,
      critical: false
    };
  }
  
  findRemainingHardcodedStrings(content) {
    const strings = [];
    const lines = content.split('\n');
    
    // Look for hardcoded strings that should have been translated
    const patterns = [
      />\s*([A-Z][^<{]+?)\s*</g, // JSX text content
      /notify\(['"]([^'"]+)['"]/g, // Notify messages
      /<Button[^>]*>([^<]+)<\/Button>/g, // Button text
    ];
    
    lines.forEach((line, lineIndex) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const text = match[1].trim();
          if (this.isLikelyTranslatable(text)) {
            strings.push({
              text: text,
              line: lineIndex + 1,
              context: line.trim()
            });
          }
        }
      });
    });
    
    return strings;
  }
  
  isLikelyTranslatable(text) {
    // Check if text looks like it should be translated
    if (text.length < 3) return false;
    if (/^[A-Z_]+$/.test(text)) return false; // Constants
    if (text.includes('${') || text.includes('{{')) return false; // Template literals
    if (text.startsWith('/')) return false; // Routes
    
    // Check if it's a common UI string
    const commonUIStrings = [
      'Save', 'Edit', 'Delete', 'Add', 'Remove', 'Update', 'Cancel', 'Submit',
      'Login', 'Logout', 'Register', 'Sign up', 'Sign in', 'Welcome', 'Hello',
      'Error', 'Success', 'Warning', 'Info', 'Loading', 'Please wait'
    ];
    
    return commonUIStrings.some(uiString => 
      text.toLowerCase().includes(uiString.toLowerCase())
    );
  }
  
  async checkSyntaxErrors(filePath, content) {
    const issues = [];
    
    // 1. Check for basic syntax errors using Node.js
    try {
      // Try to parse the file as JavaScript
      const vm = require('vm');
      const context = { require, module, exports, __dirname, __filename };
      vm.createContext(context);
      
      // Remove JSX and try to parse as JS
      const jsContent = content
        .replace(/import.*from.*['"].*['"];?\n?/g, '') // Remove imports
        .replace(/export default.*;?\n?/g, '') // Remove exports
        .replace(/<[^>]*>/g, 'null') // Replace JSX with null
        .replace(/jsx`/g, '`') // Fix template literals
        .replace(/`jsx/g, '`'); // Fix template literals
      
      vm.runInContext(jsContent, context);
    } catch (error) {
      issues.push(`Syntax error: ${error.message}`);
    }
    
    // 2. Check for common i18n syntax errors
    if (content.includes('t(\'\')') || content.includes('t("")')) {
      issues.push('Empty t() function call found');
    }
    
    // Check for unclosed t() calls
    const unclosedT = content.match(/t\(['"][^'"]*$/g);
    if (unclosedT) {
      issues.push('Unclosed t() function call found');
    }
    
    // 3. Check for proper useTranslation usage
    if (content.includes('useTranslation') && !content.includes('const { t }')) {
      issues.push('useTranslation imported but not destructured');
    }
    
    // 4. Check for missing semicolons or brackets
    const lines = content.split('\n');
    let bracketCount = 0;
    let parenCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Count brackets and parentheses
      for (const char of line) {
        if (char === '{') bracketCount++;
        if (char === '}') bracketCount--;
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
      }
    }
    
    if (bracketCount !== 0) {
      issues.push(`Unmatched brackets: ${bracketCount > 0 ? 'missing' : 'extra'} ${Math.abs(bracketCount)} closing bracket(s)`);
    }
    
    if (parenCount !== 0) {
      issues.push(`Unmatched parentheses: ${parenCount > 0 ? 'missing' : 'extra'} ${Math.abs(parenCount)} closing parenthesis`);
    }
    
    return issues;
  }
  
  checkI18nSetup(content) {
    const issues = [];
    
    // Check if useTranslation is properly imported
    if (content.includes('useTranslation')) {
      if (!content.includes('from \'react-i18next\'') && !content.includes('from "react-i18next"')) {
        issues.push('useTranslation imported from wrong package');
      }
      
      if (!content.includes('const { t } = useTranslation()')) {
        issues.push('useTranslation not properly destructured');
      }
    }
    
    // Check for proper t() usage patterns
    const tCalls = content.match(/t\(['"][^'"]*['"]\)/g) || [];
    if (tCalls.length > 0) {
      // Check for proper key naming
      tCalls.forEach(call => {
        const key = call.match(/t\(['"]([^'"]*)['"]\)/)[1];
        if (key.length < 2) {
          issues.push(`Invalid translation key: "${key}" (too short)`);
        }
        if (!key.includes('.') && key.length > 10) {
          issues.push(`Translation key should use dot notation: "${key}"`);
        }
      });
    }
    
    return issues;
  }
  
  async attemptFix(filePath, issues) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let fixedContent = content;
      let fixed = false;
      
      // Fix common issues
      for (const issue of issues) {
        if (issue.includes('Missing useTranslation import')) {
          // Add useTranslation import
          if (!fixedContent.includes('import { useTranslation }')) {
            const importLine = "import { useTranslation } from 'react-i18next';\n";
            fixedContent = importLine + fixedContent;
            fixed = true;
          }
        }
        
        if (issue.includes('useTranslation imported but not destructured')) {
          // Add destructuring
          if (fixedContent.includes('useTranslation') && !fixedContent.includes('const { t }')) {
            // Find the function component and add destructuring
            const functionMatch = fixedContent.match(/function\s+\w+\s*\([^)]*\)\s*{/);
            if (functionMatch) {
              const insertPoint = functionMatch.index + functionMatch[0].length;
              fixedContent = fixedContent.slice(0, insertPoint) + 
                '\n  const { t } = useTranslation();\n' + 
                fixedContent.slice(insertPoint);
              fixed = true;
            }
          }
        }
        
        if (issue.includes('Unclosed t() function call')) {
          // Try to fix unclosed t() calls
          fixedContent = fixedContent.replace(/t\(['"][^'"]*$/gm, (match) => {
            return match + '")';
          });
          fixed = true;
        }
      }
      
      if (fixed) {
        fs.writeFileSync(filePath, fixedContent);
        return true;
      }
      
      return false;
    } catch (error) {
      this.error(`Failed to fix ${filePath}: ${error.message}`);
      return false;
    }
  }
}

module.exports = ValidateTool;