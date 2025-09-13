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
        
        # Debug: Check if this is the Admin string
        if text == 'Admin':
            print(f"DEBUG: Safety check for 'Admin' - text: '{text}'")
            print(f"DEBUG: Context: {context}")
        
        # Debug: Check if this is the Connect Github string
        if text == 'Connect Github':
            print(f"DEBUG: Safety check for 'Connect Github' - text: '{text}'")
            print(f"DEBUG: Context: {context}")
        
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
        # Debug: Check if this is the Admin string
        if text == 'Admin':
            print(f"DEBUG: Safety _is_technical_string for 'Admin' - text: '{text}'")
        
        # URLs
        if text.startswith(('http://', 'https://', '//', 'www.')):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by URLs filter")
            return True
        
        # File paths
        if '/' in text and (text.endswith(('.js', '.jsx', '.css', '.png', '.jpg', '.svg'))):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by file paths filter")
            return True
        
        # CSS classes (kebab-case)
        if re.match(r'^[a-z][a-z0-9-]*$', text) and '-' in text:
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS classes filter")
            return True
        
        # Data attributes
        if text.startswith('data-'):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by data attributes filter")
            return True
        
        # IDs (camelCase only, not PascalCase UI text)
        if re.match(r'^[a-z][a-zA-Z0-9]*$', text) and len(text) > 3:
            if text == 'Admin':
                print(f"DEBUG: Admin caught by IDs filter")
            return True
        
        # Email addresses
        if '@' in text and '.' in text:
            if text == 'Admin':
                print(f"DEBUG: Admin caught by email addresses filter")
            return True
        
        # Numbers only
        if text.isdigit():
            if text == 'Admin':
                print(f"DEBUG: Admin caught by numbers filter")
            return True
        
        # CSS values - strings that start/end with spaces or are CSS keywords
        text_stripped = text.strip()
        css_values = {
            'nowrap', 'wrap', 'pre', 'pre-wrap', 'pre-line', 'hidden', 'visible',
            'block', 'inline', 'flex', 'grid', 'absolute', 'relative', 'fixed',
            'static', 'sticky', 'left', 'right', 'center', 'justify', 'start',
            'end', 'space-between', 'space-around', 'space-evenly', 'baseline',
            'stretch', 'normal', 'bold', 'italic', 'underline', 'none', 'auto'
        }
        if text_stripped in css_values:
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS values filter - text_stripped: '{text_stripped}'")
            return True
        
        # CSS values with spaces (like " nowrap")
        if text.startswith(' ') or text.endswith(' '):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS spaces filter")
            return True
        
        # CSS measurements
        if re.match(r'^\d+(px|em|rem|%|vh|vw|pt|pc|in|cm|mm)$', text_stripped):
            if text == 'Admin':
                print(f"DEBUG: Admin caught by CSS measurements filter")
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
        if text_stripped.lower() in technical_words:
            if text == 'Admin':
                print(f"DEBUG: Admin caught by technical words filter - text_stripped: '{text_stripped}'")
            return True
        
        if text == 'Admin':
            print(f"DEBUG: Admin passed all safety technical string filters - returning False")
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
            # Debug: Check if this is the Admin string
            if candidate.get('text') == 'Admin':
                print(f"DEBUG: get_ui_priority_strings processing 'Admin'")
            
            skip_reason = self.should_skip_string(candidate)
            if skip_reason:
                if candidate.get('text') == 'Admin':
                    print(f"DEBUG: Admin skipped by safety validator - reason: {skip_reason}")
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
