require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the Validate Tool directly
const ValidateTool = require('./tools/ValidateTool');

class ValidationTestAgent {
  constructor() {
    this.anthropic = null; // We don't need Claude for validation
    this.transformResults = {
      files: {
        'components/Header.jsx': { success: true }
      }
    };
  }

  async start() {
    console.log('🧪 Testing Validation Tool');
    console.log('='.repeat(50));
    
    // Create a test file with intentional errors
    await this.createTestFile();
    
    // Create validation tool
    const validateTool = new ValidateTool(this);
    
    try {
      // Run validation
      const results = await validateTool.execute();
      
      console.log('\n📊 Validation Results:');
      console.log(`Valid files: ${results.validFiles}`);
      console.log(`Invalid files: ${results.invalidFiles}`);
      console.log(`Total issues: ${results.issues.length}`);
      
      // Show detailed results for each file
      Object.entries(results.files).forEach(([filePath, fileData]) => {
        console.log(`\n📄 File: ${filePath}`);
        console.log(`Valid: ${fileData.isValid}`);
        console.log(`Issues: ${fileData.issues.length}`);
        
        fileData.issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue}`);
        });
      });
      
    } catch (error) {
      console.error('❌ Validation test failed:', error.message);
    }
  }

  async createTestFile() {
    const testContent = `import PropTypes from 'prop-types';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

function Header({ user, hideHeader, redirectUrl }) {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>Welcome to our site</h1>
      <button>Click here</button>
      <p>This is a test message</p>
    </div>
  );
}

export default Header;`;

    fs.writeFileSync('components/Header.jsx', testContent);
    console.log('📝 Created test file with hardcoded strings');
  }
}

// Run the test
async function main() {
  const agent = new ValidationTestAgent();
  await agent.start();
}

main().catch(console.error);
