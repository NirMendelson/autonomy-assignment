const BaseTool = require('./BaseTool');

class ReportTool extends BaseTool {
  async execute() {
    this.log('📊 Generating final report...');
    
    const report = this.generateReport();
    
    // Store results in agent state
    this.agent.finalReport = report;
    
    // Display the report
    this.displayReport(report);
    
    return report;
  }
  
  generateReport() {
    const searchResults = this.agent.searchResults || { totalStrings: 0, filesWithStrings: 0 };
    const analysisResults = this.agent.analysisResults || { filesAnalyzed: 0 };
    const organizeResults = this.agent.organizeResults || { totalStrings: 0 };
    const transformResults = this.agent.transformResults || { filesTransformed: 0 };
    const translateResults = this.agent.translateResults || { stringsTranslated: 0 };
    const localeResults = this.agent.localeResults || { localeFilesCreated: 0 };
    const validateResults = this.agent.validateResults || { validFiles: 0, invalidFiles: 0 };
    const testResults = this.agent.testResults || { passedTests: 0, totalTests: 0 };
    
    return {
      summary: {
        targetLanguage: this.agent.targetLanguage.toUpperCase(),
        totalStringsFound: searchResults.totalStrings,
        filesProcessed: analysisResults.filesAnalyzed,
        filesTransformed: transformResults.filesTransformed,
        stringsTranslated: translateResults.stringsTranslated,
        localeFilesCreated: localeResults.localeFilesCreated,
        validFiles: validateResults.validFiles,
        invalidFiles: validateResults.invalidFiles,
        testsPassed: testResults.passedTests,
        totalTests: testResults.totalTests
      },
      details: {
        search: searchResults,
        analysis: analysisResults,
        organize: organizeResults,
        transform: transformResults,
        translate: translateResults,
        locale: localeResults,
        validate: validateResults,
        test: testResults
      },
      recommendations: this.generateRecommendations(validateResults, testResults)
    };
  }
  
  displayReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SMART I18N AGENT - FINAL REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n🌍 Target Language: ${report.summary.targetLanguage}`);
    console.log(`📝 Strings Found: ${report.summary.totalStringsFound}`);
    console.log(`📄 Files Processed: ${report.summary.filesProcessed}`);
    console.log(`🛠️ Files Transformed: ${report.summary.filesTransformed}`);
    console.log(`🌐 Strings Translated: ${report.summary.stringsTranslated}`);
    console.log(`📁 Locale Files Created: ${report.summary.localeFilesCreated}`);
    
    console.log(`\n✅ Validation Results:`);
    console.log(`   Valid Files: ${report.summary.validFiles}`);
    console.log(`   Invalid Files: ${report.summary.invalidFiles}`);
    
    if (report.summary.invalidFiles > 0) {
      console.log(`   ❌ VALIDATION FAILED - ${report.summary.invalidFiles} files have issues`);
    }
    
    console.log(`\n🧪 Test Results:`);
    console.log(`   Passed: ${report.summary.testsPassed}/${report.summary.totalTests}`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 I18N TRANSFORMATION COMPLETE!');
    console.log('='.repeat(60));
  }
  
  generateRecommendations(validateResults, testResults) {
    const recommendations = [];
    
    if (validateResults.invalidFiles > 0) {
      recommendations.push(`Review ${validateResults.invalidFiles} invalid files and fix i18n implementation issues`);
    }
    
    if (testResults.totalTests > 0 && testResults.passedTests < testResults.totalTests) {
      recommendations.push(`Fix ${testResults.totalTests - testResults.passedTests} failing tests`);
    }
    
    if (validateResults.validFiles > 0) {
      recommendations.push('Test the application in the browser to ensure translations work correctly');
    }
    
    recommendations.push('Add the new locale files to your i18n configuration');
    recommendations.push('Consider adding more languages by running the agent again with different target languages');
    
    return recommendations;
  }
}

module.exports = ReportTool;
