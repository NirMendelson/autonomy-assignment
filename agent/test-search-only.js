require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the Search Tool directly
const SearchTool = require('./tools/SearchTool');

class SearchTestAgent {
  constructor() {
    this.anthropic = null; // We don't need Claude for search
    this.targetsFile = '.i18n-agent/test-targets.json';
  }

  async start() {
    console.log('🔍 Testing Search Tool on Header.jsx');
    console.log('='.repeat(50));
    
    // Create test targets file
    this.createTestTargets();
    
    // Create search tool
    const searchTool = new SearchTool(this);
    
    try {
      // Run search
      const results = await searchTool.execute();
      
      console.log('\n📊 Search Results:');
      console.log(`Total strings found: ${results.totalStrings}`);
      console.log(`Files with strings: ${results.filesWithStrings}`);
      
      // Show detailed results for each file
      Object.entries(results.files).forEach(([filePath, fileData]) => {
        console.log(`\n📄 File: ${filePath}`);
        console.log(`Strings found: ${fileData.count}`);
        
        fileData.strings.forEach((string, index) => {
          console.log(`  ${index + 1}. "${string.text}" (${string.type})`);
          console.log(`     Line ${string.line}: ${string.context}`);
        });
      });
      
    } catch (error) {
      console.error('❌ Search failed:', error.message);
    }
  }

  createTestTargets() {
    // Create test targets file with only Header.jsx
    const testTargets = ['components/Header.jsx'];
    
    // Ensure directory exists
    const dir = path.dirname(this.targetsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.targetsFile, JSON.stringify(testTargets, null, 2));
    console.log(`📝 Created test targets file: ${this.targetsFile}`);
  }
}

// Run the test
async function main() {
  const agent = new SearchTestAgent();
  await agent.start();
}

main().catch(console.error);
