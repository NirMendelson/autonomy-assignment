"""
Base tool class for all i18n agent tools.
"""

import logging
from typing import Optional, Dict, Any
from anthropic import Anthropic


class BaseTool:
    """Base class for all agent tools with common functionality."""
    
    def __init__(self, agent):
        """Initialize the base tool with agent reference."""
        self.agent = agent
        self.anthropic = agent.anthropic
        # Disable logging for cleaner output
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        self.logger.disabled = True
    
    async def ask_claude(self, prompt: str, max_tokens: int = 4000) -> str:
        """
        Send a prompt to Claude and return the response.
        
        Args:
            prompt: The prompt to send to Claude
            max_tokens: Maximum tokens for the response
            
        Returns:
            The response text from Claude
            
        Raises:
            Exception: If Claude API call fails
        """
        try:
            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as error:
            self.logger.error(f"Claude API error: {error}")
            raise error
    
    def log(self, message: str) -> None:
        """Log an info message."""
        print(f"  {message}")
    
    def error(self, message: str) -> None:
        """Log an error message."""
        print(f"  ERROR: {message}")
    
    def success(self, message: str) -> None:
        """Log a success message."""
        print(f"  SUCCESS: {message}")
    
    def warn(self, message: str) -> None:
        """Log a warning message."""
        print(f"  WARNING: {message}")
    
    def debug(self, message: str) -> None:
        """Log a debug message."""
        print(f"  DEBUG: {message}")
