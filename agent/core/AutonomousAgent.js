require('dotenv').config();
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// Import core components
const StateManager = require('../state/StateManager');
const DecisionEngine = require('../decision/DecisionEngine');
const ErrorHandler = require('../error/ErrorHandler');

// Import tools
const SearchTool = require('../tools/SearchTool');
const AnalyzeTool = require('../tools/AnalyzeTool');
const OrganizeTool = require('../tools/OrganizeTool');
const TransformTool = require('../tools/TransformTool');
const TranslateTool = require('../tools/TranslateTool');
const LocaleTool = require('../tools/LocaleTool');
const SetupTool = require('../tools/SetupTool');
const IntegrateTool = require('../tools/IntegrateTool');
const ValidateTool = require('../tools/ValidateTool');
const TestTool = require('../tools/TestTool');
const ReportTool = require('../tools/ReportTool');
const RollbackTool = require('../tools/RollbackTool');

class AutonomousAgent {
  constructor() {
    // Initialize Claude
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Initialize core components
    this.stateManager = new StateManager();
    this.decisionEngine = new DecisionEngine(this);
    this.errorHandler = new ErrorHandler(this);
    
    // Initialize tools
    this.tools = {
      search: new SearchTool(this),
      analyze: new AnalyzeTool(this),
      organize: new OrganizeTool(this),
      transform: new TransformTool(this),
      translate: new TranslateTool(this),
      locale: new LocaleTool(this),
      setup: new SetupTool(this),
      integrate: new IntegrateTool(this),
      validate: new ValidateTool(this),
      test: new TestTool(this),
      report: new ReportTool(this),
      rollback: new RollbackTool(this)
    };
    
    // Configuration
    this.config = {
      maxIterations: 50,
      timeout: 300000, // 5 minutes
      targetLanguage: process.env.I18N_TARGET_LANGUAGE || 'es'
    };
    
    // No need for targets file - files are stored in memory
  }

  async start() {
    console.log('🤖 Starting Autonomous I18n Agent...');
    console.log('='.repeat(60));
    
    try {
      // Initialize
      await this.initialize();
      
      // Main agent loop
      const success = await this.runMainLoop();
      
      if (success) {
        console.log('\n🎉 Agent completed successfully!');
        return true;
      } else {
        console.log('\n❌ Agent failed to complete the task');
        return false;
      }
      
    } catch (error) {
      console.error('\n💥 Agent crashed:', error.message);
      await this.emergencyRollback();
      return false;
    }
  }

  async initialize() {
    console.log('🔧 Initializing agent...');
    
    // Set backup directory
    this.backupDir = path.join(process.cwd(), 'backups', `i18n-${Date.now()}`);
    
    // Set target language
    this.stateManager.updateState({
      targetLanguage: this.config.targetLanguage,
      phase: 'initializing'
    });
    
    // Create backup
    await this.tools.rollback.createBackup();
    
    // Set initial goal
    this.stateManager.updateState({
      currentGoal: 'Internationalize the React application',
      phase: 'analyzing'
    });
    
    console.log('✅ Initialization complete');
  }

  async runMainLoop() {
    const startTime = Date.now();
    let iterations = 0;
    
    while (!this.stateManager.shouldStop() && iterations < this.config.maxIterations) {
      // Check timeout
      if (Date.now() - startTime > this.config.timeout) {
        console.log('⏰ Agent timeout reached');
        break;
      }
      
      iterations++;
      console.log(`\n🔄 Iteration ${iterations}/${this.config.maxIterations}`);
      
      try {
        // Decide what to do next
        const decision = await this.decisionEngine.decideNextAction();
        
        // Execute the decision
        const result = await this.executeAction(decision);
        
        // Update state based on result
        this.updateStateFromResult(decision.action, result);
        
        // Check if we're done
        if (this.isGoalAchieved()) {
          this.stateManager.setPhase('completed');
          break;
        }
        
      } catch (error) {
        console.error(`❌ Iteration ${iterations} failed:`, error.message);
        
        // Handle the error
        const errorResult = await this.errorHandler.handleError('main_loop', error);
        
        if (errorResult.stop) {
          console.log('🛑 Agent stopping due to critical error');
          break;
        }
        
        if (errorResult.action === 'rollback') {
          await this.tools.rollback.execute();
          break;
        }
      }
    }
    
    return this.stateManager.isGoalAchieved();
  }

  async executeAction(decision) {
    const { action, reasoning, confidence } = decision;
    
    console.log(`🎯 Executing: ${action} (confidence: ${confidence})`);
    console.log(`💭 Reasoning: ${reasoning}`);
    
    try {
      switch (action) {
        case 'search':
          return await this.executeSearch();
        
        case 'analyze':
          return await this.executeAnalyze();
        
        case 'organize':
          return await this.executeOrganize();
        
        case 'transform':
          return await this.executeTransform();
        
        case 'translate':
          return await this.executeTranslate();
        
        case 'locale':
          return await this.executeLocale();
        
        case 'setup':
          return await this.executeSetup();
        
        case 'integrate':
          return await this.executeIntegrate();
        
        case 'validate':
          return await this.executeValidate();
        
        case 'test':
          return await this.executeTest();
        
        case 'report':
          return await this.executeReport();
        
        case 'retry':
          return await this.executeRetry();
        
        case 'rollback':
          return await this.executeRollback();
        
        case 'complete':
          return await this.executeComplete();
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      // Handle tool-specific errors
      return await this.errorHandler.handleError(action, error, { decision });
    }
  }

  async executeSearch() {
    this.stateManager.setPhase('searching');
    const result = await this.tools.search.execute();
    this.stateManager.updateState({ searchResults: result });
    this.stateManager.addCompletedTask('search');
    return result;
  }

  async executeAnalyze() {
    this.stateManager.setPhase('analyzing');
    const result = await this.tools.analyze.execute();
    this.stateManager.updateState({ analysisResults: result });
    this.stateManager.addCompletedTask('analyze');
    return result;
  }

  async executeOrganize() {
    this.stateManager.setPhase('organizing');
    const result = await this.tools.organize.execute();
    this.stateManager.addCompletedTask('organize');
    return result;
  }

  async executeTransform() {
    this.stateManager.setPhase('transforming');
    const result = await this.tools.transform.execute();
    this.stateManager.updateState({ transformResults: result });
    this.stateManager.addCompletedTask('transform');
    return result;
  }

  async executeTranslate() {
    this.stateManager.setPhase('translating');
    const result = await this.tools.translate.execute();
    this.stateManager.updateState({ translateResults: result });
    this.stateManager.addCompletedTask('translate');
    return result;
  }

  async executeLocale() {
    this.stateManager.setPhase('locale');
    const result = await this.tools.locale.execute();
    this.stateManager.updateState({ localeResults: result });
    this.stateManager.addCompletedTask('locale');
    return result;
  }

  async executeSetup() {
    this.stateManager.setPhase('setup');
    const result = await this.tools.setup.execute();
    this.stateManager.updateState({ setupResults: result });
    this.stateManager.addCompletedTask('setup');
    return result;
  }

  async executeIntegrate() {
    this.stateManager.setPhase('integration');
    const result = await this.tools.integrate.execute();
    this.stateManager.updateState({ integrateResults: result });
    this.stateManager.addCompletedTask('integrate');
    return result;
  }

  async executeValidate() {
    this.stateManager.setPhase('validating');
    const result = await this.tools.validate.execute();
    this.stateManager.updateState({ validateResults: result });
    this.stateManager.addCompletedTask('validate');
    return result;
  }

  async executeTest() {
    this.stateManager.setPhase('testing');
    const result = await this.tools.test.execute();
    this.stateManager.addCompletedTask('test');
    return result;
  }

  async executeReport() {
    this.stateManager.setPhase('reporting');
    const result = await this.tools.report.execute();
    this.stateManager.addCompletedTask('report');
    return result;
  }

  async executeRetry() {
    console.log('🔄 Retrying previous failed action...');
    // The decision engine will determine what to retry
    return { action: 'retry', success: true };
  }

  async executeRollback() {
    console.log('🔄 Rolling back changes...');
    const result = await this.tools.rollback.execute();
    this.stateManager.setPhase('failed');
    return result;
  }

  async executeComplete() {
    console.log('✅ Marking task as complete...');
    this.stateManager.setPhase('completed');
    return { action: 'complete', success: true };
  }

  updateStateFromResult(action, result) {
    // Update context based on results
    if (result && result.files) {
      // Handle both array and object formats
      const files = Array.isArray(result.files) ? result.files : Object.keys(result.files);
      this.stateManager.updateContext({
        filesToProcess: files
      });
    }
    
    if (result && result.stringsFound) {
      this.stateManager.updateContext({
        stringsFound: result.stringsFound
      });
    }
    
    if (result && result.issues) {
      this.stateManager.updateContext({
        issues: result.issues
      });
    }
  }

  isGoalAchieved() {
    const state = this.stateManager.getState();
    
    // Check if we have completed the main workflow
    const hasTransformed = state.transformResults && state.transformResults.filesTransformed > 0;
    const hasTranslated = state.translateResults && state.translateResults.stringsTranslated > 0;
    const hasValidated = state.validateResults && state.validateResults.validFiles > 0;
    
    return hasTransformed && hasTranslated && hasValidated;
  }

  async emergencyRollback() {
    console.log('🚨 Emergency rollback initiated...');
    try {
      await this.tools.rollback.execute();
      console.log('✅ Emergency rollback completed');
    } catch (error) {
      console.error('❌ Emergency rollback failed:', error.message);
    }
  }

  // Get agent status for debugging
  getStatus() {
    const state = this.stateManager.getState();
    const errorSummary = this.errorHandler.getErrorSummary();
    
    return {
      phase: state.phase,
      completedTasks: state.completedTasks.length,
      context: state.context,
      errors: errorSummary,
      memory: this.stateManager.getMemoryInsights()
    };
  }
}

module.exports = AutonomousAgent;
