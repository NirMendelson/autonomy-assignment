"""
Safety rules and validation for i18n transformations.
"""

import re
from typing import List, Dict, Any, Optional


class SafetyValidator:
    """Validates strings and transformations for safety."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.skip_patterns = config.get('skip_patterns', [])
        self.compiled_patterns = [re.compile(pattern) for pattern in self.skip_patterns]
    
    def should_skip_string(self, context: Dict[str, Any]) -> Optional[str]:
        """Determine if a string should be skipped and return reason if so."""
        text = context['text']
        
        # Skip empty or very short strings
        if len(text.strip()) < 2:
            return "Too short"
        
        # Skip strings that match skip patterns
        for pattern in self.compiled_patterns:
            if pattern.match(text):
                return f"Matches skip pattern: {pattern.pattern}"
        
        # Skip strings that are clearly not UI text
        if self._is_technical_string(text, context):
            return "Technical string (not UI text)"
        
        # Skip strings in non-UI contexts
        if self._is_non_ui_context(context):
            return "Non-UI context"
        
        return None
    
    def _is_technical_string(self, text: str, context: Dict[str, Any]) -> bool:
        """Check if string is technical (not user-facing)."""
        # URLs
        if text.startswith(('http://', 'https://', '//', 'www.')):
            return True
        
        # File paths
        if '/' in text and (text.endswith(('.js', '.jsx', '.css', '.png', '.jpg', '.svg'))):
            return True
        
        # CSS classes (kebab-case)
        if re.match(r'^[a-z][a-z0-9-]*$', text) and '-' in text:
            return True
        
        # Data attributes
        if text.startswith('data-'):
            return True
        
        # IDs (camelCase or PascalCase)
        if re.match(r'^[a-zA-Z][a-zA-Z0-9]*$', text) and len(text) > 3:
            return True
        
        # Email addresses
        if '@' in text and '.' in text:
            return True
        
        # Numbers only
        if text.isdigit():
            return True
        
        # Single words that are likely technical
        technical_words = {
            'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
            'function', 'const', 'let', 'var', 'return', 'if', 'else',
            'for', 'while', 'do', 'switch', 'case', 'default', 'break',
            'continue', 'try', 'catch', 'finally', 'throw', 'new',
            'this', 'super', 'class', 'extends', 'import', 'export',
            'from', 'as', 'default', 'async', 'await', 'yield',
            'typeof', 'instanceof', 'in', 'of', 'delete', 'void'
        }
        if text.lower() in technical_words:
            return True
        
        return False
    
    def _is_non_ui_context(self, context: Dict[str, Any]) -> bool:
        """Check if string is in a non-UI context."""
        # Skip strings in comments
        if context.get('parent_type') == 'comment':
            return True
        
        # Skip strings in console.log, console.error, etc.
        if self._is_console_context(context):
            return True
        
        # Skip strings in error messages or debugging
        if self._is_debug_context(context):
            return True
        
        # Skip strings in className or style attributes
        attr_name = context.get('attribute_name', '')
        if attr_name in ['className', 'class', 'style', 'id', 'key', 'ref']:
            return True
        
        # Skip strings in data-* attributes
        if attr_name and attr_name.startswith('data-'):
            return True
        
        return False
    
    def _is_console_context(self, context: Dict[str, Any]) -> bool:
        """Check if string is in console logging context."""
        # This would require more sophisticated AST analysis
        # For now, we'll rely on the LLM to catch these
        return False
    
    def _is_debug_context(self, context: Dict[str, Any]) -> bool:
        """Check if string is in debugging context."""
        # This would require more sophisticated AST analysis
        # For now, we'll rely on the LLM to catch these
        return False
    
    def validate_transformation(self, original_code: str, transformed_code: str) -> bool:
        """Validate that a transformation produces valid JavaScript/JSX."""
        # Basic validation - check for balanced braces, quotes, etc.
        try:
            # Check for balanced braces
            brace_count = 0
            paren_count = 0
            bracket_count = 0
            
            for char in transformed_code:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                elif char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                elif char == '[':
                    bracket_count += 1
                elif char == ']':
                    bracket_count -= 1
                
                if brace_count < 0 or paren_count < 0 or bracket_count < 0:
                    return False
            
            return brace_count == 0 and paren_count == 0 and bracket_count == 0
        except Exception:
            return False
    
    def get_ui_priority_strings(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter and prioritize strings that are likely UI text."""
        ui_candidates = []
        
        for candidate in candidates:
            skip_reason = self.should_skip_string(candidate)
            if skip_reason:
                candidate['skip_reason'] = skip_reason
                continue
            
            # Add priority score based on context
            priority = self._calculate_priority(candidate)
            candidate['priority'] = priority
            ui_candidates.append(candidate)
        
        # Sort by priority (higher is better)
        ui_candidates.sort(key=lambda x: x['priority'], reverse=True)
        return ui_candidates
    
    def _calculate_priority(self, context: Dict[str, Any]) -> int:
        """Calculate priority score for a string candidate."""
        score = 0
        
        # High priority for JSX text content
        if context.get('is_jsx_text'):
            score += 10
        
        # High priority for aria attributes
        if context.get('is_aria_attribute'):
            score += 8
        
        # High priority for button text
        if context.get('is_button_text'):
            score += 8
        
        # High priority for link text
        if context.get('is_link_text'):
            score += 8
        
        # Medium priority for other JSX attributes
        if context.get('is_jsx_attribute'):
            score += 5
        
        # Medium priority for object properties (like menu options)
        if context.get('is_object_property'):
            score += 6
        
        # Medium priority for array elements (like menu items)
        if context.get('is_array_element'):
            score += 5
        
        # Bonus for common UI attribute names
        attr_name = context.get('attribute_name', '')
        ui_attrs = ['title', 'alt', 'placeholder', 'label', 'aria-label', 'aria-describedby']
        if attr_name in ui_attrs:
            score += 3
        
        # Bonus for longer strings (more likely to be UI text)
        text_length = len(context.get('text', ''))
        if text_length > 10:
            score += 2
        elif text_length > 5:
            score += 1
        
        # Bonus for common UI words
        text = context.get('text', '').lower()
        ui_words = ['login', 'logout', 'admin', 'connect', 'github', 'books', 'settings', 'menu']
        if any(word in text for word in ui_words):
            score += 4
        
        return score
