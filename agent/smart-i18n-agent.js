require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// Import tools
const SearchTool = require('./tools/SearchTool');
const AnalyzeTool = require('./tools/AnalyzeTool');
const OrganizeTool = require('./tools/OrganizeTool');
const TransformTool = require('./tools/TransformTool');
const TranslateTool = require('./tools/TranslateTool');
const LocaleTool = require('./tools/LocaleTool');
const ValidateTool = require('./tools/ValidateTool');
const TestTool = require('./tools/TestTool');
const ReportTool = require('./tools/ReportTool');
const RollbackTool = require('./tools/RollbackTool');

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

class SmartI18nAgent {
  constructor() {
    this.anthropic = anthropic;
    this.targetsFile = '.i18n-agent/targets.json';
    this.backupDir = '.i18n-agent/backup';
    this.localesDir = 'locales';
    this.targetLanguage = 'es'; // Default to Spanish
    this.originalLanguage = 'en';
    
    // Agent state
    this.mission = "Transform this React/Next.js website from hardcoded strings to fully internationalized";
    this.currentStep = 0;
    this.totalSteps = 10;
    this.results = {
      filesProcessed: 0,
      stringsFound: 0,
      stringsTranslated: 0,
      filesTransformed: 0,
      errors: []
    };
    
    // Initialize tools
    this.tools = {
      search: new SearchTool(this),
      analyze: new AnalyzeTool(this),
      organize: new OrganizeTool(this),
      transform: new TransformTool(this),
      translate: new TranslateTool(this),
      locale: new LocaleTool(this),
      validate: new ValidateTool(this),
      test: new TestTool(this),
      report: new ReportTool(this),
      rollback: new RollbackTool(this)
    };
  }

  async start() {
    console.log('🤖 Smart I18n Agent Starting...\n');
    console.log(`🎯 Mission: ${this.mission}`);
    
    // Ask for target language
    const targetLang = await this.askForTargetLanguage();
    this.targetLanguage = targetLang;
    
    console.log(`🌍 Target Language: ${this.targetLanguage.toUpperCase()}`);
    console.log(`📋 I'll add ${this.targetLanguage} translations to your existing ${this.originalLanguage} setup.\n`);
    
    // Execute the agent workflow
    await this.executeWorkflow();
  }

  async askForTargetLanguage() {
    // In a real implementation, this would be interactive
    // For now, we'll use Spanish as default
    console.log('🌍 What language should I add? (default: Spanish)');
    return 'es'; // Spanish
  }

  async executeWorkflow() {
    try {
      await this.step1_Initialize();
      await this.step2_Search();
      await this.step3_Analyze();
      await this.step4_Organize();
      await this.step5_Transform();
      await this.step6_Translate();
      await this.step7_Locale();
      await this.step8_Validate();
      await this.step9_Test();
      await this.step10_Report();
      
      // Final validation check
      await this.finalValidation();
      
    } catch (error) {
      console.error('❌ Agent workflow failed:', error.message);
      console.log('\n🔄 Rolling back changes...');
      await this.tools.rollback.execute();
      throw error; // Re-throw to indicate failure
    }
  }
  
  async finalValidation() {
    console.log('\n🔍 Final validation check...');
    
    // Re-run validation to ensure everything is still working
    const validateResults = await this.tools.validate.execute();
    
    if (validateResults.invalidFiles > 0) {
      throw new Error(`Final validation failed: ${validateResults.invalidFiles} files have issues`);
    }
    
    console.log('✅ Final validation passed - all files are working correctly');
  }

  async step1_Initialize() {
    this.currentStep = 1;
    console.log(`\n📋 Step ${this.currentStep}/${this.totalSteps}: Initializing...`);
    
    // Check if targets file exists
    if (!fs.existsSync(this.targetsFile)) {
      console.log('🔍 No targets file found. Running target discovery...');
      // Run the decide-targets script
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('npm run i18n:decide-targets', (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    
    // Create backup
    await this.tools.rollback.createBackup();
    
    console.log('✅ Initialization complete');
  }

  async step2_Search() {
    this.currentStep = 2;
    console.log(`\n🔍 Step ${this.currentStep}/${this.totalSteps}: Searching for hardcoded strings...`);
    
    const searchResults = await this.tools.search.execute();
    this.results.stringsFound = searchResults.totalStrings;
    this.searchResults = searchResults; // Store for other tools
    
    console.log(`✅ Found ${searchResults.totalStrings} hardcoded strings in ${searchResults.filesWithStrings} files`);
  }

  async step3_Analyze() {
    this.currentStep = 3;
    console.log(`\n📊 Step ${this.currentStep}/${this.totalSteps}: Analyzing files for translation needs...`);
    
    const analysisResults = await this.tools.analyze.execute();
    this.results.filesProcessed = analysisResults.filesAnalyzed;
    
    console.log(`✅ Analyzed ${analysisResults.filesAnalyzed} files`);
  }

  async step4_Organize() {
    this.currentStep = 4;
    console.log(`\n🗂️ Step ${this.currentStep}/${this.totalSteps}: Organizing strings into categories...`);
    
    const organizeResults = await this.tools.organize.execute();
    
    console.log(`✅ Organized strings into ${organizeResults.categories.length} categories`);
  }

  async step5_Transform() {
    this.currentStep = 5;
    console.log(`\n🛠️ Step ${this.currentStep}/${this.totalSteps}: Transforming files to use t() calls...`);
    
    const transformResults = await this.tools.transform.execute();
    this.results.filesTransformed = transformResults.filesTransformed;
    
    console.log(`✅ Transformed ${transformResults.filesTransformed} files`);
  }

  async step6_Translate() {
    this.currentStep = 6;
    console.log(`\n🌐 Step ${this.currentStep}/${this.totalSteps}: Translating strings to ${this.targetLanguage.toUpperCase()}...`);
    
    const translateResults = await this.tools.translate.execute();
    this.results.stringsTranslated = translateResults.stringsTranslated;
    
    console.log(`✅ Translated ${translateResults.stringsTranslated} strings`);
  }

  async step7_Locale() {
    this.currentStep = 7;
    console.log(`\n📝 Step ${this.currentStep}/${this.totalSteps}: Creating locale files...`);
    
    const localeResults = await this.tools.locale.execute();
    
    console.log(`✅ Created ${this.targetLanguage} locale files`);
  }

  async step8_Validate() {
    this.currentStep = 8;
    console.log(`\n✅ Step ${this.currentStep}/${this.totalSteps}: Validating i18n implementation...`);
    
    const validateResults = await this.tools.validate.execute();
    this.results.validFiles = validateResults.validFiles;
    this.results.invalidFiles = validateResults.invalidFiles;
    
    console.log(`✅ Validation complete: ${validateResults.validFiles} valid, ${validateResults.invalidFiles} invalid files`);
    
    // If validation failed, throw error to trigger rollback
    if (validateResults.invalidFiles > 0) {
      const criticalIssues = Object.values(validateResults.files)
        .filter(file => file.critical)
        .map(file => file.issues.join(', '));
      
      if (criticalIssues.length > 0) {
        throw new Error(`Critical validation errors found: ${criticalIssues.join('; ')}`);
      }
    }
  }

  async step9_Test() {
    this.currentStep = 9;
    console.log(`\n🧪 Step ${this.currentStep}/${this.totalSteps}: Testing application...`);
    
    const testResults = await this.tools.test.execute();
    
    console.log(`✅ Tests passed: ${testResults.passedTests}/${testResults.totalTests}`);
  }

  async step10_Report() {
    this.currentStep = 10;
    console.log(`\n📊 Step ${this.currentStep}/${this.totalSteps}: Generating final report...`);
    
    await this.tools.report.execute();
    
    console.log('\n🎉 Smart I18n Agent Complete!');
  }
}

// All tool implementations are now in separate files in the tools/ directory

// Run the agent
async function main() {
  const agent = new SmartI18nAgent();
  
  try {
    await agent.start();
    console.log('\n🎉 Smart I18n Agent completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smart I18n Agent failed:', error.message);
    console.log('\n🔄 All changes have been rolled back.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SmartI18nAgent;
