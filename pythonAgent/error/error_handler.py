"""
Error handling and recovery mechanisms for the autonomous i18n agent.
"""

import asyncio
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from tools.base_tool import BaseTool


class ErrorType(Enum):
    """Types of errors that can occur."""
    SYNTAX_ERROR = "syntax_error"
    FILE_NOT_FOUND = "file_not_found"
    PERMISSION_ERROR = "permission_error"
    NETWORK_ERROR = "network_error"
    API_ERROR = "api_error"
    VALIDATION_ERROR = "validation_error"
    UNKNOWN_ERROR = "unknown_error"


class HandlingStrategy(Enum):
    """Error handling strategies."""
    RETRY = "retry"
    ALTERNATIVE = "alternative"
    SKIP = "skip"
    STOP = "stop"


@dataclass
class ErrorAnalysis:
    """Analysis of an error."""
    tool: str
    error_type: ErrorType
    message: str
    stack: str
    context: Dict[str, Any]
    can_retry: bool
    retry_count: int
    is_critical: bool
    suggested_fix: str


@dataclass
class ErrorHandlingResult:
    """Result of error handling."""
    action: str
    retry: bool = False
    alternative: bool = False
    skipped: bool = False
    stop: bool = False
    unknown: bool = False


class ErrorHandler(BaseTool):
    """Handles errors and determines recovery strategies."""
    
    def __init__(self, agent):
        """Initialize the error handler."""
        super().__init__(agent)
        self.state_manager = agent.state_manager
    
    async def handle_error(self, tool_name: str, error: Exception, context: Dict[str, Any] = None) -> ErrorHandlingResult:
        """
        Handle an error that occurred in a tool.
        
        Args:
            tool_name: Name of the tool that failed
            error: The exception that occurred
            context: Additional context about the error
            
        Returns:
            ErrorHandlingResult with the recommended action
        """
        if context is None:
            context = {}
            
        self.error(f"Error in {tool_name}: {error}")
        
        # Record the failure
        self.state_manager.record_failed_attempt(tool_name, error)
        
        # Analyze the error
        error_analysis = await self._analyze_error(error, tool_name, context)
        
        # Decide how to handle it
        handling_strategy = await self._decide_error_handling(error_analysis)
        
        # Execute the strategy
        return await self._execute_error_handling(handling_strategy, tool_name, error, context)
    
    async def _analyze_error(self, error: Exception, tool_name: str, context: Dict[str, Any]) -> ErrorAnalysis:
        """Analyze an error to understand its type and severity."""
        analysis = ErrorAnalysis(
            tool=tool_name,
            error_type=self._categorize_error(error),
            message=str(error),
            stack=str(error.__traceback__) if hasattr(error, '__traceback__') else '',
            context=context,
            can_retry=self.state_manager.should_retry(tool_name),
            retry_count=self.state_manager.get_retry_count(tool_name),
            is_critical=self._is_critical_error(error),
            suggested_fix=self._suggest_fix(error, tool_name)
        )
        
        return analysis
    
    def _categorize_error(self, error: Exception) -> ErrorType:
        """Categorize an error based on its message."""
        message = str(error).lower()
        
        if 'syntax' in message or 'parse' in message:
            return ErrorType.SYNTAX_ERROR
        
        if 'not found' in message or 'missing' in message:
            return ErrorType.FILE_NOT_FOUND
        
        if 'permission' in message or 'access' in message:
            return ErrorType.PERMISSION_ERROR
        
        if 'network' in message or 'timeout' in message:
            return ErrorType.NETWORK_ERROR
        
        if 'api' in message or 'claude' in message:
            return ErrorType.API_ERROR
        
        if 'validation' in message or 'invalid' in message:
            return ErrorType.VALIDATION_ERROR
        
        return ErrorType.UNKNOWN_ERROR
    
    def _is_critical_error(self, error: Exception) -> bool:
        """Check if an error is critical and should stop the agent."""
        message = str(error).lower()
        
        # Critical errors that should stop the agent
        critical_patterns = [
            'cannot read property',
            'undefined is not a function',
            'syntax error',
            'permission denied',
            'disk space',
            'memory'
        ]
        
        return any(pattern in message for pattern in critical_patterns)
    
    def _suggest_fix(self, error: Exception, tool_name: str) -> str:
        """Suggest a fix for an error."""
        error_type = self._categorize_error(error)
        
        suggestions = {
            ErrorType.SYNTAX_ERROR: 'Check file syntax and fix errors',
            ErrorType.FILE_NOT_FOUND: 'Verify file paths and ensure files exist',
            ErrorType.PERMISSION_ERROR: 'Check file permissions and access rights',
            ErrorType.NETWORK_ERROR: 'Retry after network issues are resolved',
            ErrorType.API_ERROR: 'Check API key and rate limits',
            ErrorType.VALIDATION_ERROR: 'Fix validation issues in the code',
            ErrorType.UNKNOWN_ERROR: 'Review error details and try alternative approach'
        }
        
        return suggestions.get(error_type, 'Review error details and try alternative approach')
    
    async def _decide_error_handling(self, error_analysis: ErrorAnalysis) -> Dict[str, Any]:
        """Decide how to handle an error based on analysis."""
        tool = error_analysis.tool
        error_type = error_analysis.error_type
        can_retry = error_analysis.can_retry
        retry_count = error_analysis.retry_count
        is_critical = error_analysis.is_critical
        
        # Critical errors - stop everything
        if is_critical:
            return {
                'strategy': HandlingStrategy.STOP,
                'action': 'rollback',
                'reason': 'Critical error detected'
            }
        
        # Can retry - try again
        if can_retry and retry_count < 3:
            return {
                'strategy': HandlingStrategy.RETRY,
                'action': tool,
                'reason': f'Retry {tool} (attempt {retry_count + 1})',
                'delay': self._calculate_retry_delay(retry_count)
            }
        
        # Too many retries - try alternative approach
        if retry_count >= 3:
            return {
                'strategy': HandlingStrategy.ALTERNATIVE,
                'action': self._get_alternative_action(tool),
                'reason': f'Too many retries for {tool}, trying alternative'
            }
        
        # Default - skip and continue
        return {
            'strategy': HandlingStrategy.SKIP,
            'action': 'continue',
            'reason': f'Skipping {tool} due to error'
        }
    
    async def _execute_error_handling(self, strategy: Dict[str, Any], tool_name: str, error: Exception, context: Dict[str, Any]) -> ErrorHandlingResult:
        """Execute the error handling strategy."""
        strategy_type = strategy['strategy']
        
        if strategy_type == HandlingStrategy.RETRY:
            delay = strategy.get('delay', 1000)
            self.log(f"Retrying {tool_name} in {delay}ms...")
            await asyncio.sleep(delay / 1000)  # Convert to seconds
            return ErrorHandlingResult(action=strategy['action'], retry=True)
        
        elif strategy_type == HandlingStrategy.ALTERNATIVE:
            self.log(f"Trying alternative approach: {strategy['action']}")
            return ErrorHandlingResult(action=strategy['action'], alternative=True)
        
        elif strategy_type == HandlingStrategy.SKIP:
            self.log(f"Skipping {tool_name} and continuing...")
            return ErrorHandlingResult(action='continue', skipped=True)
        
        elif strategy_type == HandlingStrategy.STOP:
            self.error("Stopping agent due to critical error")
            return ErrorHandlingResult(action='rollback', stop=True)
        
        else:
            self.log(f"Unknown error handling strategy: {strategy_type}")
            return ErrorHandlingResult(action='continue', unknown=True)
    
    def _get_alternative_action(self, tool_name: str) -> str:
        """Get an alternative action for a failed tool."""
        alternatives = {
            'search': 'analyze',
            'analyze': 'transform',
            'transform': 'translate',
            'translate': 'locale',
            'locale': 'setup',
            'setup': 'integrate',
            'integrate': 'validate',
            'validate': 'complete'
        }
        
        return alternatives.get(tool_name, 'search')
    
    def _calculate_retry_delay(self, retry_count: int) -> int:
        """Calculate retry delay with exponential backoff."""
        # Exponential backoff: 1s, 2s, 4s, 8s
        return min(1000 * (2 ** retry_count), 8000)
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get error summary for reporting."""
        state = self.state_manager.get_state()
        summary = {
            'total_errors': 0,
            'errors_by_tool': {},
            'critical_errors': 0,
            'retryable_errors': 0
        }
        
        for tool, attempts in state.failed_attempts.items():
            summary['total_errors'] += len(attempts)
            summary['errors_by_tool'][tool] = len(attempts)
            
            for attempt in attempts:
                if self._is_critical_error(Exception(attempt.error)):
                    summary['critical_errors'] += 1
                else:
                    summary['retryable_errors'] += 1
        
        return summary
