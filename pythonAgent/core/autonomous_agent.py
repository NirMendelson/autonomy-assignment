"""
Autonomous I18n Agent - Main orchestrator for internationalization workflow.
"""

import asyncio
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from anthropic import Anthropic

from state.state_manager import StateManager
from decision.decision_engine import DecisionEngine
from error.error_handler import ErrorHandler


class AutonomousAgent:
    """Main autonomous agent for internationalizing React applications."""
    
    def __init__(self):
        """Initialize the autonomous agent."""
        # Initialize Claude
        self.anthropic = Anthropic(
            api_key=os.getenv('ANTHROPIC_API_KEY')
        )
        
        # Initialize core components
        self.state_manager = StateManager()
        self.decision_engine = DecisionEngine(self)
        self.error_handler = ErrorHandler(self)
        
        # Initialize tools (will be imported when needed to avoid circular imports)
        self.tools = {}
        
        # Configuration
        self.config = {
            'max_iterations': 50,
            'timeout': 300,  # 5 minutes in seconds
            'target_language': os.getenv('I18N_TARGET_LANGUAGE', 'es')
        }
        
        # Setup logging
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup logging configuration."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler('i18n_agent.log')
            ]
        )
        # Disable logging for cleaner output
        self.logger = logging.getLogger(__name__)
        self.logger.disabled = True
    
    async def start(self) -> bool:
        """
        Start the autonomous agent.
        
        Returns:
            True if successful, False otherwise
        """
        print('Starting Autonomous I18n Agent...')
        print('=' * 60)
        
        try:
            # Initialize
            await self._initialize()
            
            # Main agent loop
            success = await self._run_main_loop()
            
            if success:
                print('\nSUCCESS: Agent completed successfully!')
                return True
            else:
                print('\nFAILED: Agent failed to complete the task')
                return False
                
        except Exception as error:
            print(f'\nCRASHED: Agent crashed: {error}')
            await self._emergency_rollback()
            return False
    
    async def _initialize(self):
        """Initialize the agent."""
        print('Initializing agent...')
        
        # Set target language
        self.state_manager.update_state({
            'target_language': self.config['target_language'],
            'phase': 'initializing'
        })
        
        # Initialize tools
        await self._initialize_tools()
        
        # Set initial goal
        self.state_manager.update_state({
            'current_goal': 'Internationalize the React application',
            'phase': 'analyzing'
        })
        
        print('SUCCESS: Initialization complete')
    
    async def _initialize_tools(self):
        """Initialize all tools (lazy import to avoid circular dependencies)."""
        # Import tools here to avoid circular imports
        from tools.search_tool import SearchTool
        from tools.analyze_tool import AnalyzeTool
        from tools.transform_tool import TransformTool
        from tools.translate_tool import TranslateTool
        from tools.locale_tool import LocaleTool
        from tools.setup_tool import SetupTool
        from tools.integrate_tool import IntegrateTool
        from tools.validate_tool import ValidateTool
        from tools.rollback_tool import RollbackTool
        from tools.report_tool import ReportTool
        
        # Initialize tools
        self.tools = {
            'search': SearchTool(self),
            'analyze': AnalyzeTool(self),
            'transform': TransformTool(self),
            'translate': TranslateTool(self),
            'locale': LocaleTool(self),
            'setup': SetupTool(self),
            'integrate': IntegrateTool(self),
            'validate': ValidateTool(self),
            'rollback': RollbackTool(self),
            'report': ReportTool(self)
        }
    
    async def _run_main_loop(self) -> bool:
        """Run the main agent loop."""
        start_time = datetime.now()
        iterations = 0
        
        while not self.state_manager.should_stop() and iterations < self.config['max_iterations']:
            # Check timeout
            elapsed = (datetime.now() - start_time).total_seconds()
            if elapsed > self.config['timeout']:
                print('TIMEOUT: Agent timeout reached')
                break
            
            iterations += 1
            print(f'\nIteration {iterations}/{self.config["max_iterations"]}')
            
            try:
                # Decide what to do next
                decision = await self.decision_engine.decide_next_action()
                
                # Execute the decision
                result = await self._execute_action(decision)
                
                # Update state based on result
                self._update_state_from_result(decision.action, result)
                
                # Check if we're done
                if self._is_goal_achieved():
                    self.state_manager.set_phase('completed')
                    break
                
            except KeyboardInterrupt:
                print('\nSTOPPED: Agent stopped by user')
                return False
            except Exception as error:
                print(f'FAILED: Iteration {iterations} failed: {error}')
                
                # Handle the error
                error_result = await self.error_handler.handle_error('main_loop', error)
                
                if error_result.stop:
                    print('🛑 Agent stopping due to critical error')
                    self.logger.error('Agent stopping due to critical error')
                    break
                
                if error_result.action == 'rollback':
                    if 'rollback' in self.tools:
                        await self.tools['rollback'].execute()
                    break
        
        return self.state_manager.is_goal_achieved()
    
    async def _execute_action(self, decision) -> Any:
        """Execute an action based on the decision."""
        action = decision.action
        reasoning = decision.reasoning
        confidence = decision.confidence
        
        print(f'Executing: {action} (confidence: {confidence})')
        print(f'Reasoning: {reasoning}')
        
        try:
            if action == 'search':
                return await self._execute_search()
            elif action == 'analyze':
                return await self._execute_analyze()
            elif action == 'transform':
                return await self._execute_transform()
            elif action == 'translate':
                return await self._execute_translate()
            elif action == 'locale':
                return await self._execute_locale()
            elif action == 'setup':
                return await self._execute_setup()
            elif action == 'integrate':
                return await self._execute_integrate()
            elif action == 'validate':
                return await self._execute_validate()
            elif action == 'retry':
                return await self._execute_retry()
            elif action == 'rollback':
                return await self._execute_rollback()
            elif action == 'complete':
                return await self._execute_complete()
            else:
                raise ValueError(f'Unknown action: {action}')
        except Exception as error:
            # Handle tool-specific errors
            return await self.error_handler.handle_error(action, error, {'decision': decision})
    
    async def _execute_search(self):
        """Execute search action."""
        self.state_manager.set_phase('searching')
        result = await self.tools['search'].execute()
        self.state_manager.update_state({'search_results': result})
        self.state_manager.add_completed_task('search')
        return result
    
    async def _execute_analyze(self):
        """Execute analyze action."""
        self.state_manager.set_phase('analyzing')
        result = await self.tools['analyze'].execute()
        self.state_manager.update_state({'analysis_results': result})
        self.state_manager.add_completed_task('analyze')
        return result
    
    async def _execute_transform(self):
        """Execute transform action."""
        self.state_manager.set_phase('transforming')
        result = await self.tools['transform'].execute()
        self.state_manager.update_state({'transform_results': result})
        self.state_manager.add_completed_task('transform')
        return result
    
    async def _execute_translate(self):
        """Execute translate action."""
        self.state_manager.set_phase('translating')
        result = await self.tools['translate'].execute()
        self.state_manager.update_state({'translate_results': result})
        self.state_manager.add_completed_task('translate')
        return result
    
    async def _execute_locale(self):
        """Execute locale action."""
        self.state_manager.set_phase('locale')
        result = await self.tools['locale'].execute()
        self.state_manager.update_state({'locale_results': result})
        self.state_manager.add_completed_task('locale')
        return result
    
    async def _execute_setup(self):
        """Execute setup action."""
        self.state_manager.set_phase('setup')
        result = await self.tools['setup'].execute()
        self.state_manager.update_state({'setup_results': result})
        self.state_manager.add_completed_task('setup')
        return result
    
    async def _execute_integrate(self):
        """Execute integrate action."""
        self.state_manager.set_phase('integration')
        result = await self.tools['integrate'].execute()
        self.state_manager.update_state({'integrate_results': result})
        self.state_manager.add_completed_task('integrate')
        return result
    
    async def _execute_validate(self):
        """Execute validate action."""
        self.state_manager.set_phase('validating')
        result = await self.tools['validate'].execute()
        self.state_manager.update_state({'validate_results': result})
        self.state_manager.add_completed_task('validate')
        return result
    
    async def _execute_retry(self):
        """Execute retry action."""
        print('Retrying previous action...')
        self.logger.info('Retrying previous action')
        # Simple retry - just continue with the loop
        return {'retry': True}
    
    async def _execute_rollback(self):
        """Execute rollback action."""
        if 'rollback' in self.tools:
            return await self.tools['rollback'].execute()
        return {'rollback': True}
    
    async def _execute_complete(self):
        """Execute complete action."""
        print('SUCCESS: Marking task as complete...')
        self.logger.info('Marking task as complete')
        self.state_manager.set_phase('completed')
        return {'complete': True}
    
    def _update_state_from_result(self, action: str, result: Any):
        """Update state based on action result."""
        if result and isinstance(result, dict):
            if 'files_found' in result:
                self.state_manager.update_context({'files_to_process': result['files_found']})
            if 'strings_found' in result:
                self.state_manager.update_context({'strings_found': result['strings_found']})
            if 'issues' in result:
                self.state_manager.update_context({'issues': result['issues']})
    
    def _is_goal_achieved(self) -> bool:
        """Check if the goal has been achieved."""
        return self.state_manager.is_goal_achieved()
    
    async def _emergency_rollback(self):
        """Perform emergency rollback."""
        print('EMERGENCY: Performing emergency rollback...')
        self.logger.error('Performing emergency rollback')
        
        if 'rollback' in self.tools:
            try:
                await self.tools['rollback'].execute()
            except Exception as error:
                print(f'FAILED: Emergency rollback failed: {error}')
                self.logger.error(f'Emergency rollback failed: {error}')
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status."""
        state = self.state_manager.get_state()
        return {
            'phase': state.phase,
            'target_language': state.target_language,
            'completed_tasks': len(state.completed_tasks),
            'files_processed': len(state.context.files_to_process),
            'strings_found': state.context.strings_found if state.context.strings_found else 0,
            'issues': len(state.context.issues),
            'is_goal_achieved': self._is_goal_achieved()
        }
