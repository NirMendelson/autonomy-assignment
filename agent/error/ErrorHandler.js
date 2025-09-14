const BaseTool = require('../tools/BaseTool');

class ErrorHandler extends BaseTool {
  constructor(agent) {
    super(agent);
    this.stateManager = agent.stateManager;
  }

  async handleError(toolName, error, context = {}) {
    this.error(`❌ Error in ${toolName}: ${error.message}`);
    
    // Record the failure
    this.stateManager.recordFailedAttempt(toolName, error);
    
    // Analyze the error
    const errorAnalysis = await this.analyzeError(error, toolName, context);
    
    // Decide how to handle it
    const handlingStrategy = await this.decideErrorHandling(errorAnalysis);
    
    // Execute the strategy
    return await this.executeErrorHandling(handlingStrategy, toolName, error, context);
  }

  async analyzeError(error, toolName, context) {
    const analysis = {
      tool: toolName,
      errorType: this.categorizeError(error),
      message: error.message,
      stack: error.stack,
      context: context,
      canRetry: this.stateManager.shouldRetry(toolName),
      retryCount: this.stateManager.getRetryCount(toolName),
      isCritical: this.isCriticalError(error),
      suggestedFix: this.suggestFix(error, toolName)
    };
    
    return analysis;
  }

  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('syntax') || message.includes('parse')) {
      return 'syntax_error';
    }
    
    if (message.includes('not found') || message.includes('missing')) {
      return 'file_not_found';
    }
    
    if (message.includes('permission') || message.includes('access')) {
      return 'permission_error';
    }
    
    if (message.includes('network') || message.includes('timeout')) {
      return 'network_error';
    }
    
    if (message.includes('api') || message.includes('claude')) {
      return 'api_error';
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation_error';
    }
    
    return 'unknown_error';
  }

  isCriticalError(error) {
    const message = error.message.toLowerCase();
    
    // Critical errors that should stop the agent
    const criticalPatterns = [
      'cannot read property',
      'undefined is not a function',
      'syntax error',
      'permission denied',
      'disk space',
      'memory'
    ];
    
    return criticalPatterns.some(pattern => message.includes(pattern));
  }

  suggestFix(error, toolName) {
    const errorType = this.categorizeError(error);
    
    switch (errorType) {
      case 'syntax_error':
        return 'Check file syntax and fix errors';
      
      case 'file_not_found':
        return 'Verify file paths and ensure files exist';
      
      case 'permission_error':
        return 'Check file permissions and access rights';
      
      case 'network_error':
        return 'Retry after network issues are resolved';
      
      case 'api_error':
        return 'Check API key and rate limits';
      
      case 'validation_error':
        return 'Fix validation issues in the code';
      
      default:
        return 'Review error details and try alternative approach';
    }
  }

  async decideErrorHandling(errorAnalysis) {
    const { tool, errorType, canRetry, retryCount, isCritical } = errorAnalysis;
    
    // Critical errors - stop everything
    if (isCritical) {
      return {
        strategy: 'stop',
        action: 'rollback',
        reason: 'Critical error detected'
      };
    }
    
    // Can retry - try again
    if (canRetry && retryCount < 3) {
      return {
        strategy: 'retry',
        action: tool,
        reason: `Retry ${tool} (attempt ${retryCount + 1})`,
        delay: this.calculateRetryDelay(retryCount)
      };
    }
    
    // Too many retries - try alternative approach
    if (retryCount >= 3) {
      return {
        strategy: 'alternative',
        action: this.getAlternativeAction(tool),
        reason: `Too many retries for ${tool}, trying alternative`
      };
    }
    
    // Default - skip and continue
    return {
      strategy: 'skip',
      action: 'continue',
      reason: `Skipping ${tool} due to error`
    };
  }

  async executeErrorHandling(strategy, toolName, error, context) {
    switch (strategy.strategy) {
      case 'retry':
        this.log(`🔄 Retrying ${toolName} in ${strategy.delay}ms...`);
        await this.sleep(strategy.delay);
        return { action: strategy.action, retry: true };
      
      case 'alternative':
        this.log(`🔄 Trying alternative approach: ${strategy.action}`);
        return { action: strategy.action, alternative: true };
      
      case 'skip':
        this.log(`⏭️ Skipping ${toolName} and continuing...`);
        return { action: 'continue', skipped: true };
      
      case 'stop':
        this.error(`🛑 Stopping agent due to critical error`);
        return { action: 'rollback', stop: true };
      
      default:
        this.log(`❓ Unknown error handling strategy: ${strategy.strategy}`);
        return { action: 'continue', unknown: true };
    }
  }

  getAlternativeAction(toolName) {
    const alternatives = {
      'search': 'analyze',
      'analyze': 'transform',
      'transform': 'translate',
      'translate': 'locale',
      'locale': 'validate',
      'validate': 'complete'
    };
    
    return alternatives[toolName] || 'search';
  }

  calculateRetryDelay(retryCount) {
    // Exponential backoff: 1s, 2s, 4s, 8s
    return Math.min(1000 * Math.pow(2, retryCount), 8000);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get error summary for reporting
  getErrorSummary() {
    const state = this.stateManager.getState();
    const summary = {
      totalErrors: 0,
      errorsByTool: {},
      criticalErrors: 0,
      retryableErrors: 0
    };
    
    Object.entries(state.failedAttempts).forEach(([tool, attempts]) => {
      summary.totalErrors += attempts.length;
      summary.errorsByTool[tool] = attempts.length;
      
      attempts.forEach(attempt => {
        if (this.isCriticalError({ message: attempt.error })) {
          summary.criticalErrors++;
        } else {
          summary.retryableErrors++;
        }
      });
    });
    
    return summary;
  }
}

module.exports = ErrorHandler;
