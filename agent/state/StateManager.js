class StateManager {
  constructor() {
    this.state = {
      // Agent phase
      phase: 'initializing', // initializing, analyzing, searching, transforming, validating, completed, failed
      
      // Current goal and context
      currentGoal: null,
      targetLanguage: 'es',
      
      // Progress tracking
      completedTasks: [],
      failedAttempts: {},
      retryCount: 0,
      maxRetries: 3,
      
      // Context data
      context: {
        filesToProcess: [],
        stringsFound: [],
        translationsNeeded: [],
        issues: [],
        validFiles: [],
        invalidFiles: []
      },
      
      // Results from tools
      searchResults: null,
      analysisResults: null,
      transformResults: null,
      translateResults: null,
      validateResults: null,
      
      // Agent memory
      memory: {
        successfulStrategies: [],
        failedStrategies: [],
        learnedPatterns: []
      }
    };
  }

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Update state
  updateState(updates) {
    this.state = { ...this.state, ...updates };
  }

  // Update context
  updateContext(contextUpdates) {
    this.state.context = { ...this.state.context, ...contextUpdates };
  }

  // Add completed task
  addCompletedTask(task) {
    this.state.completedTasks.push({
      task,
      timestamp: new Date().toISOString(),
      phase: this.state.phase
    });
  }

  // Record failed attempt
  recordFailedAttempt(tool, error) {
    if (!this.state.failedAttempts[tool]) {
      this.state.failedAttempts[tool] = [];
    }
    this.state.failedAttempts[tool].push({
      error: error.message,
      timestamp: new Date().toISOString(),
      phase: this.state.phase
    });
  }

  // Check if we should retry
  shouldRetry(tool) {
    const attempts = this.state.failedAttempts[tool] || [];
    return attempts.length < this.state.maxRetries;
  }

  // Get retry count for tool
  getRetryCount(tool) {
    return (this.state.failedAttempts[tool] || []).length;
  }

  // Check if goal is achieved
  isGoalAchieved() {
    return this.state.phase === 'completed';
  }

  // Check if agent should stop
  shouldStop() {
    return this.state.phase === 'completed' || this.state.phase === 'failed';
  }

  // Set phase
  setPhase(phase) {
    this.state.phase = phase;
  }

  // Add to memory
  addToMemory(type, data) {
    this.state.memory[type].push({
      data,
      timestamp: new Date().toISOString(),
      phase: this.state.phase
    });
  }

  // Get memory insights
  getMemoryInsights() {
    return {
      successfulStrategies: this.state.memory.successfulStrategies,
      failedStrategies: this.state.memory.failedStrategies,
      learnedPatterns: this.state.memory.learnedPatterns
    };
  }

  // Reset state
  reset() {
    this.state = {
      phase: 'initializing',
      currentGoal: null,
      targetLanguage: 'es',
      completedTasks: [],
      failedAttempts: {},
      retryCount: 0,
      maxRetries: 3,
      context: {
        filesToProcess: [],
        stringsFound: [],
        translationsNeeded: [],
        issues: [],
        validFiles: [],
        invalidFiles: []
      },
      searchResults: null,
      analysisResults: null,
      transformResults: null,
      translateResults: null,
      validateResults: null,
      memory: {
        successfulStrategies: [],
        failedStrategies: [],
        learnedPatterns: []
      }
    };
  }
}

module.exports = StateManager;
