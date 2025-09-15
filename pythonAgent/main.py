#!/usr/bin/env python3
"""
Main entry point for the Python I18n Agent.
"""

import asyncio
import os
import sys
import signal
import logging
from pathlib import Path
from dotenv import load_dotenv

# Disable httpx logging
logging.getLogger("httpx").setLevel(logging.WARNING)

# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    """Handle interrupt signals."""
    global shutdown_requested
    print('\nSTOPPED: Agent stopped by user')
    shutdown_requested = True
    sys.exit(1)

# Load environment variables from .env file
load_dotenv()

# Add the pythonAgent directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from core.autonomous_agent import AutonomousAgent


async def main():
    """Main function to run the autonomous i18n agent."""
    # Check for required environment variables
    if not os.getenv('ANTHROPIC_API_KEY'):
        print('ERROR: ANTHROPIC_API_KEY environment variable is required')
        print('Please set your Anthropic API key in the .env file or environment')
        sys.exit(1)
    
    # Create and start the agent
    agent = AutonomousAgent()
    
    try:
        success = await agent.start()
        
        if success:
            print('\nSUCCESS: Agent completed internationalization!')
            print('Your app is now ready for multiple languages.')
            sys.exit(0)
        else:
            print('\nFAILED: Agent could not complete internationalization')
            print('Check the logs for more details.')
            sys.exit(1)
            
    except KeyboardInterrupt:
        print('\nSTOPPED: Agent stopped by user')
        # Force exit immediately
        os._exit(1)
    except Exception as error:
        print(f'\nFATAL ERROR: {error}')
        sys.exit(1)


if __name__ == '__main__':
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the async main function
    asyncio.run(main())
