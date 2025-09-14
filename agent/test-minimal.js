require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the Autonomous Agent
const AutonomousAgent = require('./core/AutonomousAgent');

class MinimalTestAgent extends AutonomousAgent {
  constructor() {
    super();
    this.testDir = 'test-i18n';
    this.testMode = true; // Enable test mode
  }

  async start() {
    console.log('🧪 Testing Autonomous I18n Agent on Minimal Test Folder');
    console.log('='.repeat(60));
    
    // Setup test environment
    await this.setupTestEnvironment();
    
    // Run the autonomous agent
    const success = await super.start();
    
    if (success) {
      console.log('\n✅ Test completed successfully!');
      this.showTestResults();
    } else {
      console.log('\n❌ Test failed');
    }
    
    return success;
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    // Verify test folder exists
    if (!fs.existsSync(this.testDir)) {
      throw new Error(`Test directory ${this.testDir} not found`);
    }
    
    // Verify Header.jsx exists in test folder
    const headerPath = path.join(this.testDir, 'components', 'Header.jsx');
    if (!fs.existsSync(headerPath)) {
      throw new Error(`Header.jsx not found in ${this.testDir}/components/`);
    }
    
    console.log(`✅ Test environment ready: ${this.testDir}/`);
    console.log(`📁 Files in test folder:`);
    this.listTestFiles();
  }

  listTestFiles() {
    const listFiles = (dir, prefix = '') => {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          console.log(`${prefix}📁 ${item}/`);
          listFiles(itemPath, prefix + '  ');
        } else {
          console.log(`${prefix}📄 ${item}`);
        }
      });
    };
    
    listFiles(this.testDir);
  }

  showTestResults() {
    const status = this.getStatus();
    
    console.log('\n📊 Test Results:');
    console.log(`Phase: ${status.phase}`);
    console.log(`Completed tasks: ${status.completedTasks}`);
    console.log(`Files processed: ${status.context.filesToProcess.length}`);
    console.log(`Strings found: ${status.context.stringsFound.length}`);
    console.log(`Issues: ${status.context.issues.length}`);
    
    if (status.errors.totalErrors > 0) {
      console.log(`\n⚠️ Errors encountered: ${status.errors.totalErrors}`);
      Object.entries(status.errors.errorsByTool).forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count} errors`);
      });
    }
    
    console.log('\n🧠 Agent Memory:');
    console.log(`Successful strategies: ${status.memory.successfulStrategies.length}`);
    console.log(`Failed strategies: ${status.memory.failedStrategies.length}`);
    console.log(`Learned patterns: ${status.memory.learnedPatterns.length}`);
    
    // Show what files were processed
    if (status.context.filesToProcess.length > 0) {
      console.log('\n📁 Files processed:');
      status.context.filesToProcess.forEach(file => {
        console.log(`  - ${file}`);
      });
    }
  }
}

// Run the test
async function main() {
  const agent = new MinimalTestAgent();
  await agent.start();
}

main().catch(console.error);
