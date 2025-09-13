"""
LLM integration for string classification and i18n key generation.
"""

import json
import os
from typing import List, Dict, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class LLMClassifier:
    """Uses OpenAI to classify strings and generate i18n keys."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        api_key = os.getenv('OPENAI_API_KEY')
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv('MODEL', 'gpt-4o-mini')
        
        if not self.client.api_key:
            self.client = None
    
    def classify_strings(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Classify a batch of string candidates for i18n treatment."""
        if not self.client:
            # Return candidates with skip reason
            for candidate in candidates:
                candidate['action'] = 'skip'
                candidate['reason'] = 'No OpenAI API key provided'
            return candidates
        
        results = []
        
        # Process in batches to avoid token limits
        batch_size = 10
        for i in range(0, len(candidates), batch_size):
            batch = candidates[i:i + batch_size]
            batch_results = self._process_batch(batch)
            results.extend(batch_results)
        
        return results
    
    def _process_batch(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process a batch of string candidates."""
        # Create context for the batch
        context_items = []
        for i, candidate in enumerate(candidates):
            context_items.append({
                'id': i,
                'text': candidate['text'],
                'file_path': candidate['file_path'],
                'line': candidate['line'],
                'context': candidate.get('context', ''),
                'attribute_name': candidate.get('attribute_name', ''),
                'is_jsx_text': candidate.get('is_jsx_text', False),
                'is_jsx_attribute': candidate.get('is_jsx_attribute', False),
            })
        
        prompt = self._create_classification_prompt(context_items)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._get_system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=2000
            )
            
            result_text = response.choices[0].message.content
            return self._parse_classification_response(result_text, candidates)
            
        except Exception as e:
            print(f"Error in LLM classification: {e}")
            # Return candidates with skip reason
            for candidate in candidates:
                candidate['action'] = 'skip'
                candidate['reason'] = f'LLM error: {str(e)}'
            return candidates
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for string classification."""
        return """You are an expert at identifying user-visible text in React/JSX code for internationalization.

Your task is to analyze JavaScript/JSX code and identify strings that should be internationalized (i18n).

For each string, determine:
1. Is this user-visible text that should be translated?
2. If yes, what should the i18n key be?
3. What wrapper should be used (t() for simple text, <Trans> for complex markup)?

Rules:
- Skip technical strings: URLs, file paths, CSS classes, IDs, data attributes, console.log messages
- Skip strings in non-UI contexts: className, style, id, key, ref attributes
- Skip very short strings (< 3 characters) unless they're clearly UI text
- Skip strings that are clearly debugging or error messages
- Focus on strings that users will see in the interface

For i18n keys, use a hierarchical structure like:
- common.button.submit
- menu.logout
- form.label.email
- error.validation.required

Return your response as a JSON array where each item has:
- id: the candidate ID
- action: "replace" or "skip"
- key: the i18n key (if action is "replace")
- defaultMessage: the original text (if action is "replace")
- wrapper: "t" or "Trans" (if action is "replace")
- reason: why it was skipped (if action is "skip")"""
    
    def _create_classification_prompt(self, context_items: List[Dict[str, Any]]) -> str:
        """Create the prompt for classifying string candidates."""
        prompt_parts = [
            "Analyze these string candidates from React/JSX code and determine which should be internationalized:",
            ""
        ]
        
        for item in context_items:
            prompt_parts.extend([
                f"ID {item['id']}:",
                f"  Text: \"{item['text']}\"",
                f"  File: {item['file_path']}:{item['line']}",
                f"  Context: {item['context']}",
                f"  Attribute: {item['attribute_name'] or 'N/A'}",
                f"  JSX Text: {item['is_jsx_text']}",
                f"  JSX Attribute: {item['is_jsx_attribute']}",
                ""
            ])
        
        prompt_parts.extend([
            "Return a JSON array with your analysis. Each item should have:",
            "- id: the candidate ID",
            "- action: 'replace' or 'skip'",
            "- key: i18n key (if replacing)",
            "- defaultMessage: original text (if replacing)", 
            "- wrapper: 't' or 'Trans' (if replacing)",
            "- reason: skip reason (if skipping)",
            "",
            "JSON:"
        ])
        
        return '\n'.join(prompt_parts)
    
    def _parse_classification_response(self, response_text: str, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parse the LLM response and merge with candidates."""
        try:
            # Extract JSON from response
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON array found in response")
            
            json_text = response_text[json_start:json_end]
            classifications = json.loads(json_text)
            
            # Merge classifications with candidates
            result = []
            for candidate in candidates:
                # Find matching classification by ID
                classification = None
                for cls in classifications:
                    if cls.get('id') == candidates.index(candidate):
                        classification = cls
                        break
                
                if classification:
                    candidate.update(classification)
                else:
                    # Default to skip if no classification found
                    candidate['action'] = 'skip'
                    candidate['reason'] = 'No classification found'
                
                result.append(candidate)
            
            return result
            
        except Exception as e:
            print(f"Error parsing LLM response: {e}")
            # Return candidates with error
            for candidate in candidates:
                candidate['action'] = 'skip'
                candidate['reason'] = f'Parse error: {str(e)}'
            return candidates
    
    def generate_i18n_config(self, keys: List[str]) -> Dict[str, Any]:
        """Generate i18n configuration based on discovered keys."""
        # Group keys by namespace
        namespaces = {}
        for key in keys:
            if '.' in key:
                namespace = key.split('.')[0]
            else:
                namespace = 'common'
            
            if namespace not in namespaces:
                namespaces[namespace] = []
            namespaces[namespace].append(key)
        
        return {
            'namespaces': list(namespaces.keys()),
            'keys': keys,
            'total_keys': len(keys)
        }
