require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the Smart I18n Agent
const SmartI18nAgent = require('./smart-i18n-agent');

class SingleFileTestAgent extends SmartI18nAgent {
  constructor() {
    super();
    this.testFile = 'components/Header.jsx';
  }

  async start() {
    console.log('🧪 Testing Smart I18n Agent on single file: Header.jsx');
    console.log('='.repeat(60));
    
    // Override the targets to only include Header.jsx
    this.targetsFile = '.i18n-agent/test-targets.json';
    
    // Create test targets file
    this.createTestTargets();
    
    // Run the workflow
    await this.runWorkflow();
  }

  createTestTargets() {
    // Create test targets file with only Header.jsx
    const testTargets = [this.testFile];
    
    // Ensure directory exists
    const dir = path.dirname(this.targetsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.targetsFile, JSON.stringify(testTargets, null, 2));
    console.log(`📝 Created test targets file: ${this.targetsFile}`);
  }

  async runWorkflow() {
    try {
      // Step 1: Initialize
      await this.step1_Initialize();
      
      // Step 2: Search
      await this.step2_Search();
      
      // Step 3: Analyze
      await this.step3_Analyze();
      
      // Step 4: Organize
      await this.step4_Organize();
      
      // Step 5: Transform
      await this.step5_Transform();
      
      // Step 6: Translate
      await this.step6_Translate();
      
      // Step 7: Locale
      await this.step7_Locale();
      
      // Step 8: Validate
      await this.step8_Validate();
      
      // Step 9: Test
      await this.step9_Test();
      
      // Step 10: Report
      await this.step10_Report();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.log('\n🔄 Rolling back changes...');
      await this.tools.rollback.execute();
    }
  }
}

// Run the test
async function main() {
  const agent = new SingleFileTestAgent();
  await agent.start();
}

main().catch(console.error);
