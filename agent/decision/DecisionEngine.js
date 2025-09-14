const BaseTool = require('../tools/BaseTool');

class DecisionEngine extends BaseTool {
  constructor(agent) {
    super(agent);
    this.stateManager = agent.stateManager;
  }

  async decideNextAction() {
    const state = this.stateManager.getState();
    
    // Analyze current state
    const analysis = await this.analyzeCurrentState();
    
    // Use Claude to decide what to do next
    const prompt = this.buildDecisionPrompt(state, analysis);
    
    try {
      const response = await this.askClaude(prompt, 4000);
      const decision = this.parseDecision(response);
      
      this.log(`🤔 Decision: ${decision.action} - ${decision.reasoning}`);
      return decision;
    } catch (error) {
      this.error(`Decision failed: ${error.message}`);
      return this.getFallbackDecision(state);
    }
  }

  async analyzeCurrentState() {
    const state = this.stateManager.getState();
    const analysis = {
      phase: state.phase,
      hasFiles: state.context.filesToProcess.length > 0,
      hasStrings: state.context.stringsFound.length > 0,
      hasTranslations: state.context.translationsNeeded.length > 0,
      hasIssues: state.context.issues.length > 0,
      completedTasks: state.completedTasks.length,
      failedAttempts: Object.keys(state.failedAttempts).length,
      canRetry: this.canRetryAnyTool(),
      isStuck: this.isAgentStuck()
    };
    
    return analysis;
  }

  buildDecisionPrompt(state, analysis) {
    return `You are an autonomous AI agent for internationalizing React applications.

CURRENT STATE:
- Phase: ${state.phase}
- Target Language: ${state.targetLanguage}
- Files to process: ${state.context.filesToProcess.length}
- Strings found: ${state.context.stringsFound.length}
- Issues: ${state.context.issues.length}
- Completed tasks: ${state.completedTasks.length}
- Failed attempts: ${Object.keys(state.failedAttempts).length}

ANALYSIS:
- Has files: ${analysis.hasFiles}
- Has strings: ${analysis.hasStrings}
- Has translations: ${analysis.hasTranslations}
- Has issues: ${analysis.hasIssues}
- Can retry: ${analysis.canRetry}
- Is stuck: ${analysis.isStuck}

AVAILABLE ACTIONS:
1. search - Find hardcoded strings in files
2. analyze - Deep analysis of files for translation needs
3. transform - Convert hardcoded strings to t() calls
4. translate - Generate translations for strings
5. locale - Create locale files
6. validate - Check for errors and issues
7. retry - Try again with different approach
8. rollback - Undo changes and start over
9. complete - Finish successfully

RECENT FAILURES:
${this.getRecentFailures()}

What should I do next? Consider:
- What phase am I in?
- What data do I have?
- What's the logical next step?
- Should I retry something that failed?
- Am I stuck and need to change strategy?

Respond with JSON:
{
  "action": "action_name",
  "reasoning": "Why this action makes sense",
  "confidence": 0.8,
  "expectedOutcome": "What should happen",
  "fallbackAction": "What to do if this fails"
}`;
  }

  parseDecision(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.error(`Failed to parse decision: ${error.message}`);
    }
    
    // Fallback parsing
    const actionMatch = response.match(/action["\s]*:["\s]*([a-z_]+)/i);
    const reasoningMatch = response.match(/reasoning["\s]*:["\s]*"([^"]+)"/i);
    
    return {
      action: actionMatch ? actionMatch[1] : 'search',
      reasoning: reasoningMatch ? reasoningMatch[1] : 'Fallback decision',
      confidence: 0.5,
      expectedOutcome: 'Continue workflow',
      fallbackAction: 'retry'
    };
  }

  getFallbackDecision(state) {
    // Simple fallback logic based on state
    if (state.phase === 'initializing') {
      return { action: 'search', reasoning: 'Start by finding strings', confidence: 0.6 };
    }
    
    if (state.context.filesToProcess.length === 0) {
      return { action: 'search', reasoning: 'Need to find files first', confidence: 0.7 };
    }
    
    if (state.context.stringsFound.length === 0) {
      return { action: 'search', reasoning: 'Need to find strings', confidence: 0.7 };
    }
    
    if (state.phase === 'searching' && state.context.stringsFound.length > 0) {
      return { action: 'analyze', reasoning: 'Analyze found strings', confidence: 0.8 };
    }
    
    if (state.phase === 'analyzing' && state.analysisResults) {
      return { action: 'transform', reasoning: 'Transform strings to t() calls', confidence: 0.8 };
    }
    
    if (state.phase === 'transforming' && state.transformResults) {
      return { action: 'translate', reasoning: 'Generate translations', confidence: 0.8 };
    }
    
    if (state.phase === 'translating' && state.translateResults) {
      return { action: 'locale', reasoning: 'Create locale files', confidence: 0.8 };
    }
    
    if (state.phase === 'locale' && state.localeResults) {
      return { action: 'validate', reasoning: 'Validate implementation', confidence: 0.8 };
    }
    
    if (state.phase === 'validating') {
      return { action: 'complete', reasoning: 'Validation complete', confidence: 0.9 };
    }
    
    return { action: 'search', reasoning: 'Default fallback', confidence: 0.5 };
  }

  canRetryAnyTool() {
    const state = this.stateManager.getState();
    return Object.keys(state.failedAttempts).some(tool => 
      this.stateManager.shouldRetry(tool)
    );
  }

  isAgentStuck() {
    const state = this.stateManager.getState();
    const recentTasks = state.completedTasks.slice(-5);
    
    // Check if we're repeating the same tasks
    if (recentTasks.length >= 3) {
      const lastThree = recentTasks.slice(-3);
      const allSame = lastThree.every(task => task.task === lastThree[0].task);
      if (allSame) return true;
    }
    
    // Check if we have too many failed attempts
    const totalFailures = Object.values(state.failedAttempts).reduce((sum, attempts) => sum + attempts.length, 0);
    if (totalFailures > 10) return true;
    
    return false;
  }

  getRecentFailures() {
    const state = this.stateManager.getState();
    const failures = [];
    
    Object.entries(state.failedAttempts).forEach(([tool, attempts]) => {
      if (attempts.length > 0) {
        const lastAttempt = attempts[attempts.length - 1];
        failures.push(`${tool}: ${lastAttempt.error} (${attempts.length} attempts)`);
      }
    });
    
    return failures.length > 0 ? failures.join('\n') : 'None';
  }
}

module.exports = DecisionEngine;
