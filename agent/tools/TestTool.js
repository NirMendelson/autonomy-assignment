const { exec } = require('child_process');
const BaseTool = require('./BaseTool');

class TestTool extends BaseTool {
  async execute() {
    this.log('🧪 Testing application...');
    
    const results = {
      passedTests: 0,
      totalTests: 0,
      errors: []
    };
    
    // Run different types of tests
    const tests = [
      { name: 'Syntax Check', fn: () => this.runSyntaxCheck() },
      { name: 'Build Test', fn: () => this.runBuildTest() },
      { name: 'Lint Check', fn: () => this.runLintCheck() }
    ];
    
    for (const test of tests) {
      try {
        this.log(`  Running ${test.name}...`);
        const testResult = await test.fn();
        results.totalTests++;
        
        if (testResult.success) {
          results.passedTests++;
          this.success(`${test.name} passed`);
        } else {
          results.errors.push(`${test.name}: ${testResult.error}`);
          this.error(`${test.name} failed: ${testResult.error}`);
        }
      } catch (error) {
        results.totalTests++;
        results.errors.push(`${test.name}: ${error.message}`);
        this.error(`${test.name} failed: ${error.message}`);
      }
    }
    
    // Store results in agent state
    this.agent.testResults = results;
    
    return results;
  }
  
  async runSyntaxCheck() {
    return new Promise((resolve) => {
      exec('node -c server/server.js', (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
  
  async runBuildTest() {
    return new Promise((resolve) => {
      exec('npm run build', (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
  
  async runLintCheck() {
    return new Promise((resolve) => {
      exec('npm run lint', (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
}

module.exports = TestTool;
