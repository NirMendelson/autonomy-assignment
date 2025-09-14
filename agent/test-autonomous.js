require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the Autonomous Agent
const AutonomousAgent = require('./core/AutonomousAgent');

class TestAutonomousAgent extends AutonomousAgent {
  constructor() {
    super();
    this.testFile = 'components/Header.jsx';
  }

  async start() {
    console.log('🧪 Testing Autonomous I18n Agent on Header.jsx');
    console.log('='.repeat(60));
    
    // Override the targets to only include Header.jsx
    this.stateManager.updateState({
      targetLanguage: 'es'
    });
    
    // Create test targets file
    this.createTestTargets();
    
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

  createTestTargets() {
    // Create test targets file with only Header.jsx
    const testTargets = [this.testFile];
    
    // Ensure directory exists
    const dir = '.i18n-agent';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync('.i18n-agent/test-targets.json', JSON.stringify(testTargets, null, 2));
    console.log(`📝 Created test targets file: .i18n-agent/test-targets.json`);
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
  }
}

// Run the test
async function main() {
  const agent = new TestAutonomousAgent();
  await agent.start();
}

main().catch(console.error);
