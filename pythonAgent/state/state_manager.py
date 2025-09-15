"""
State management for the autonomous i18n agent.
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field


@dataclass
class TaskRecord:
    """Record of a completed task."""
    task: str
    timestamp: str
    phase: str


@dataclass
class FailedAttempt:
    """Record of a failed attempt."""
    error: str
    timestamp: str
    phase: str


@dataclass
class MemoryEntry:
    """Entry in agent memory."""
    data: Any
    timestamp: str
    phase: str


@dataclass
class AgentContext:
    """Context data for the agent."""
    files_to_process: List[str] = field(default_factory=list)
    strings_found: int = 0
    analysis_results: Optional[Dict[str, Any]] = None
    translations_needed: List[Dict[str, Any]] = field(default_factory=list)
    issues: List[str] = field(default_factory=list)
    valid_files: List[str] = field(default_factory=list)
    invalid_files: List[str] = field(default_factory=list)


@dataclass
class AgentMemory:
    """Agent memory for learning and adaptation."""
    successful_strategies: List[MemoryEntry] = field(default_factory=list)
    failed_strategies: List[MemoryEntry] = field(default_factory=list)
    learned_patterns: List[MemoryEntry] = field(default_factory=list)


@dataclass
class AgentState:
    """Complete agent state."""
    # Agent phase
    phase: str = 'initializing'  # initializing, analyzing, searching, transforming, validating, completed, failed
    
    # Current goal and context
    current_goal: Optional[str] = None
    target_language: str = 'es'
    
    # Progress tracking
    completed_tasks: List[TaskRecord] = field(default_factory=list)
    failed_attempts: Dict[str, List[FailedAttempt]] = field(default_factory=dict)
    retry_count: int = 0
    max_retries: int = 3
    
    # Context data
    context: AgentContext = field(default_factory=AgentContext)
    
    # Results from tools
    search_results: Optional[Dict[str, Any]] = None
    analysis_results: Optional[Dict[str, Any]] = None
    transform_results: Optional[Dict[str, Any]] = None
    translate_results: Optional[Dict[str, Any]] = None
    locale_results: Optional[Dict[str, Any]] = None
    setup_results: Optional[Dict[str, Any]] = None
    integrate_results: Optional[Dict[str, Any]] = None
    validate_results: Optional[Dict[str, Any]] = None
    
    # Agent memory
    memory: AgentMemory = field(default_factory=AgentMemory)


class StateManager:
    """Manages the state of the autonomous i18n agent."""
    
    def __init__(self):
        """Initialize the state manager with default state."""
        self.state = AgentState()
    
    def get_state(self) -> AgentState:
        """Get current state (returns a copy)."""
        return AgentState(
            phase=self.state.phase,
            current_goal=self.state.current_goal,
            target_language=self.state.target_language,
            completed_tasks=self.state.completed_tasks.copy(),
            failed_attempts=self.state.failed_attempts.copy(),
            retry_count=self.state.retry_count,
            max_retries=self.state.max_retries,
            context=self.state.context,
            search_results=self.state.search_results,
            analysis_results=self.state.analysis_results,
            transform_results=self.state.transform_results,
            translate_results=self.state.translate_results,
            locale_results=self.state.locale_results,
            setup_results=self.state.setup_results,
            integrate_results=self.state.integrate_results,
            validate_results=self.state.validate_results,
            memory=self.state.memory
        )
    
    def update_state(self, updates: Dict[str, Any]) -> None:
        """Update state with provided updates."""
        for key, value in updates.items():
            if hasattr(self.state, key):
                setattr(self.state, key, value)
    
    def update_context(self, context_updates: Dict[str, Any]) -> None:
        """Update context with provided updates."""
        for key, value in context_updates.items():
            if hasattr(self.state.context, key):
                setattr(self.state.context, key, value)
    
    def add_completed_task(self, task: str) -> None:
        """Add a completed task to the state."""
        task_record = TaskRecord(
            task=task,
            timestamp=datetime.now().isoformat(),
            phase=self.state.phase
        )
        self.state.completed_tasks.append(task_record)
    
    def record_failed_attempt(self, tool: str, error: Exception) -> None:
        """Record a failed attempt for a tool."""
        if tool not in self.state.failed_attempts:
            self.state.failed_attempts[tool] = []
        
        failed_attempt = FailedAttempt(
            error=str(error),
            timestamp=datetime.now().isoformat(),
            phase=self.state.phase
        )
        self.state.failed_attempts[tool].append(failed_attempt)
    
    def should_retry(self, tool: str) -> bool:
        """Check if we should retry a tool."""
        attempts = self.state.failed_attempts.get(tool, [])
        return len(attempts) < self.state.max_retries
    
    def get_retry_count(self, tool: str) -> int:
        """Get retry count for a tool."""
        return len(self.state.failed_attempts.get(tool, []))
    
    def is_goal_achieved(self) -> bool:
        """Check if the goal is achieved."""
        return self.state.phase == 'completed'
    
    def should_stop(self) -> bool:
        """Check if the agent should stop."""
        return self.state.phase in ['completed', 'failed']
    
    def set_phase(self, phase: str) -> None:
        """Set the current phase."""
        self.state.phase = phase
    
    def add_to_memory(self, memory_type: str, data: Any) -> None:
        """Add data to agent memory."""
        memory_entry = MemoryEntry(
            data=data,
            timestamp=datetime.now().isoformat(),
            phase=self.state.phase
        )
        
        if memory_type == 'successful_strategies':
            self.state.memory.successful_strategies.append(memory_entry)
        elif memory_type == 'failed_strategies':
            self.state.memory.failed_strategies.append(memory_entry)
        elif memory_type == 'learned_patterns':
            self.state.memory.learned_patterns.append(memory_entry)
    
    def get_memory_insights(self) -> Dict[str, List[MemoryEntry]]:
        """Get memory insights."""
        return {
            'successful_strategies': self.state.memory.successful_strategies,
            'failed_strategies': self.state.memory.failed_strategies,
            'learned_patterns': self.state.memory.learned_patterns
        }
    
    def reset(self) -> None:
        """Reset state to initial values."""
        self.state = AgentState()
