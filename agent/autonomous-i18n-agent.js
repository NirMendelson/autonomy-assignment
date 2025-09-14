const AutonomousAgent = require('./core/AutonomousAgent');

// Main entry point
async function main() {
  const agent = new AutonomousAgent();
  
  try {
    console.log('🚀 Starting Autonomous I18n Agent...');
    console.log('This agent will intelligently decide how to internationalize your app');
    console.log('='.repeat(70));
    
    const success = await agent.start();
    
    if (success) {
      console.log('\n🎉 SUCCESS: Agent completed internationalization!');
      console.log('Your app is now ready for multiple languages.');
      process.exit(0);
    } else {
      console.log('\n❌ FAILED: Agent could not complete the task');
      console.log('Check the logs above for details.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 CRASH: Agent encountered a fatal error');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = AutonomousAgent;
