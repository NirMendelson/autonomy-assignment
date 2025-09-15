"""
Decision engine for the autonomous i18n agent.
"""

import json
import re
from typing import Dict, Any, List
from dataclasses import dataclass

from tools.base_tool import BaseTool


@dataclass
class Decision:
    """Represents a decision made by the agent."""
    action: str
    reasoning: str
    confidence: float
    expected_outcome: str
    fallback_action: str


class DecisionEngine(BaseTool):
    """Decision engine that determines the next action for the agent."""
    
    def __init__(self, agent):
        """Initialize the decision engine."""
        super().__init__(agent)
        self.state_manager = agent.state_manager
    
    async def decide_next_action(self) -> Decision:
        """
        Decide what action to take next based on current state.
        
        Returns:
            Decision object with the recommended action
        """
        state = self.state_manager.get_state()
        
        # Analyze current state
        analysis = await self._analyze_current_state()
        
        # Use Claude to decide what to do next
        prompt = self._build_decision_prompt(state, analysis)
        
        try:
            response = await self.ask_claude(prompt, 4000)
            decision = self._parse_decision(response)
            
            self.log(f"Decision: {decision.action} - {decision.reasoning}")
            return decision
        except Exception as error:
            self.error(f"Decision failed: {error}")
            return self._get_fallback_decision(state)
    
    async def _analyze_current_state(self) -> Dict[str, Any]:
        """Analyze the current state to understand what we have."""
        state = self.state_manager.get_state()
        
        analysis = {
            'phase': state.phase,
            'has_files': len(state.context.files_to_process) > 0,
            'has_strings': (
                (state.context.strings_found and state.context.strings_found > 0) or
                (state.analysis_results and state.analysis_results.get('strings_found', 0) > 0)
            ),
            'has_translations': (
                (state.translate_results and state.translate_results.get('strings_translated', 0) > 0) or
                state.phase == 'translating_complete'
            ),
            'has_transformed_code': (
                (state.transform_results and state.transform_results.get('files_transformed', 0) > 0) or
                state.phase == 'transforming_complete'
            ),
            'has_locale_files': (
                (state.locale_results and state.locale_results.get('locale_files_created', 0) > 0) or
                state.phase == 'locale_complete'
            ),
            'has_i18n_setup': (
                (state.setup_results and state.setup_results.get('config_files_created', 0) > 0) or
                state.phase == 'setup_complete'
            ),
            'has_integration': (
                (state.integrate_results and state.integrate_results.get('integration_complete', False)) or
                state.phase == 'integration_complete'
            ),
            'has_issues': len(state.context.issues) > 0,
            'completed_tasks': len(state.completed_tasks),
            'failed_attempts': len(state.failed_attempts),
            'can_retry': self._can_retry_any_tool(),
            'is_stuck': self._is_agent_stuck()
        }
        
        return analysis
    
    def _build_decision_prompt(self, state: Any, analysis: Dict[str, Any]) -> str:
        """Build the decision prompt for Claude."""
        return f"""You are an autonomous AI agent for internationalizing React applications.

CURRENT STATE:
- Phase: {state.phase}
- Target Language: {state.target_language}
- Files to process: {len(state.context.files_to_process)}
- Strings found: {state.context.strings_found if state.context.strings_found else 0}
- Issues: {len(state.context.issues)}
- Completed tasks: {len(state.completed_tasks)}
- Failed attempts: {len(state.failed_attempts)}

ANALYSIS:
- Has files: {analysis['has_files']}
- Has strings: {analysis['has_strings']}
- Has transformed code: {analysis['has_transformed_code']}
- Has translations: {analysis['has_translations']}
- Has locale files: {analysis['has_locale_files']}
- Has i18n setup: {analysis['has_i18n_setup']}
- Has integration: {analysis['has_integration']}
- Has issues: {analysis['has_issues']}
- Can retry: {analysis['can_retry']}
- Is stuck: {analysis['is_stuck']}

AVAILABLE ACTIONS:
1. search - Find hardcoded strings in files
2. analyze - Deep analysis of files for translation needs
3. transform - Convert hardcoded strings to t() calls
4. translate - Generate translations for strings
5. locale - Create locale files
6. setup - Create i18n configuration and provider
7. integrate - Integrate i18n into Next.js app
8. validate - Check for errors and issues
9. retry - Try again with different approach
10. rollback - Undo changes and start over
11. complete - Finish successfully

RECENT FAILURES:
{self._get_recent_failures()}

What should I do next? Consider:
- What phase am I in?
- What data do I have?
- What's the logical next step?
- Should I retry something that failed?
- Am I stuck and need to change strategy?

IMPORTANT WORKFLOW RULES:
- If I have files but no strings found → use "analyze" to find strings
- If I have strings but no transformed code → use "transform" to replace with t() calls
- If I have transformed code but no translations → use "translate"
- If I have translations but no locale files → use "locale" to create translation files
- If I have locale files but no i18n setup → use "setup" to create configuration
- If I have i18n setup but no integration → use "integrate" to integrate into app
- If I have integration but haven't validated → use "validate" to check everything works
- If everything is complete and working → use "complete" to finish
- Don't keep repeating the same action if it's not finding new data
- SearchTool only discovers files, AnalyzeTool finds strings in files
- Transform before translate - replace hardcoded strings with t() calls first
- If phase is 'transforming_complete' and no translations → use "translate"
- If phase is 'translating_complete' and no locale files → use "locale"
- If phase is 'locale_complete' and no i18n setup → use "setup"
- If phase is 'setup_complete' and no integration → use "integrate"

Respond with JSON:
{{
  "action": "action_name",
  "reasoning": "Why this action makes sense",
  "confidence": 0.8,
  "expectedOutcome": "What should happen",
  "fallbackAction": "What to do if this fails"
}}"""
    
    def _parse_decision(self, response: str) -> Decision:
        """Parse Claude's response into a Decision object."""
        try:
            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                decision_data = json.loads(json_match.group(0))
                return Decision(
                    action=decision_data.get('action', 'search'),
                    reasoning=decision_data.get('reasoning', 'Fallback decision'),
                    confidence=decision_data.get('confidence', 0.5),
                    expected_outcome=decision_data.get('expectedOutcome', 'Continue workflow'),
                    fallback_action=decision_data.get('fallbackAction', 'retry')
                )
        except Exception as error:
            self.error(f"Failed to parse decision: {error}")
        
        # Fallback parsing
        action_match = re.search(r'action["\s]*:["\s]*([a-z_]+)', response, re.IGNORECASE)
        reasoning_match = re.search(r'reasoning["\s]*:["\s]*"([^"]+)"', response, re.IGNORECASE)
        
        return Decision(
            action=action_match.group(1) if action_match else 'search',
            reasoning=reasoning_match.group(1) if reasoning_match else 'Fallback decision',
            confidence=0.5,
            expected_outcome='Continue workflow',
            fallback_action='retry'
        )
    
    def _get_fallback_decision(self, state: Any) -> Decision:
        """Get a fallback decision based on simple state analysis."""
        # Simple fallback logic based on state
        if state.phase == 'initializing':
            return Decision('search', 'Start by finding strings', 0.6, 'Find files to process', 'retry')
        
        if len(state.context.files_to_process) == 0:
            return Decision('search', 'Need to find files first', 0.7, 'Find files to process', 'retry')
        
        # If we have files but no strings, analyze them
        if (len(state.context.files_to_process) > 0 and 
            (not state.context.strings_found or state.context.strings_found == 0)):
            return Decision('analyze', 'Have files but no strings - need to analyze files', 0.8, 'Find strings in files', 'retry')
        
        if state.phase == 'searching' and state.context.strings_found:
            return Decision('analyze', 'Analyze found strings', 0.8, 'Analyze strings for translation', 'retry')
        
        if state.phase == 'analyzing' and state.analysis_results:
            return Decision('transform', 'Transform strings to t() calls', 0.8, 'Replace strings with t() calls', 'retry')
        
        if state.phase == 'transforming' and state.transform_results:
            return Decision('translate', 'Generate translations', 0.8, 'Create translations', 'retry')
        
        if state.phase == 'translating' and state.translate_results:
            return Decision('locale', 'Create locale files', 0.8, 'Create locale files', 'retry')
        
        if state.phase == 'locale' and state.locale_results:
            return Decision('setup', 'Create i18n setup', 0.8, 'Create i18n configuration', 'retry')
        
        if state.phase == 'setup' and state.setup_results:
            return Decision('integrate', 'Integrate i18n into app', 0.8, 'Integrate i18n into Next.js', 'retry')
        
        if state.phase == 'integration' and state.integrate_results:
            return Decision('validate', 'Validate implementation', 0.8, 'Validate everything works', 'retry')
        
        if state.phase == 'validating':
            return Decision('complete', 'Validation complete', 0.9, 'Finish successfully', 'retry')
        
        return Decision('search', 'Default fallback', 0.5, 'Continue workflow', 'retry')
    
    def _can_retry_any_tool(self) -> bool:
        """Check if we can retry any tool."""
        state = self.state_manager.get_state()
        return any(self.state_manager.should_retry(tool) for tool in state.failed_attempts.keys())
    
    def _is_agent_stuck(self) -> bool:
        """Check if the agent is stuck in a loop."""
        state = self.state_manager.get_state()
        recent_tasks = state.completed_tasks[-5:]
        
        # Check if we're repeating the same tasks
        if len(recent_tasks) >= 3:
            last_three = recent_tasks[-3:]
            all_same = all(task.task == last_three[0].task for task in last_three)
            if all_same:
                return True
        
        # Check if we have too many failed attempts
        total_failures = sum(len(attempts) for attempts in state.failed_attempts.values())
        if total_failures > 10:
            return True
        
        return False
    
    def _get_recent_failures(self) -> str:
        """Get recent failures for the prompt."""
        state = self.state_manager.get_state()
        failures = []
        
        for tool, attempts in state.failed_attempts.items():
            if attempts:
                last_attempt = attempts[-1]
                failures.append(f"{tool}: {last_attempt.error} ({len(attempts)} attempts)")
        
        return '\n'.join(failures) if failures else 'None'
