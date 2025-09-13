"""
AST parsing utilities for JavaScript/JSX files using tree-sitter.
"""

import os
import re
from typing import List, Dict, Any, Optional, Tuple
import tree_sitter
from tree_sitter import Language, Parser
from pathspec import PathSpec


class JavaScriptASTParser:
    """Parser for JavaScript/JSX files using tree-sitter."""
    
    def __init__(self):
        self.parser = Parser()
        # Load the JavaScript language
        try:
            import tree_sitter_javascript
            self.language = Language(tree_sitter_javascript.language())
            self.parser.language = self.language
        except Exception as e:
            print(f"Error loading tree-sitter JavaScript: {e}")
            raise
    
    def parse_file(self, file_path: str) -> Optional[tuple]:
        """Parse a JavaScript/JSX file and return the AST and content."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            tree = self.parser.parse(bytes(content, 'utf8'))
            return tree, content
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return None
    
    def find_string_literals(self, tree: tree_sitter.Tree, file_path: str, content: str) -> List[Dict[str, Any]]:
        """Find all string literals in the AST that might be UI text."""
        candidates = []
        
        def traverse(node, depth=0):
            # Debug: Check for any node around line 84 (Connect Github)
            if (hasattr(node, 'start_point') and 
                node.start_point[0] + 1 == 84):
                print(f"DEBUG: Line 84 node: type={node.type}, text='{node.text.decode('utf-8') if node.text else 'None'}'")
            
            # Debug: Check for Connect Github specifically
            if (hasattr(node, 'text') and 
                node.text and 
                'Connect Github' in node.text.decode('utf-8')):
                print(f"DEBUG: Found 'Connect Github': type={node.type}, line={node.start_point[0] + 1 if hasattr(node, 'start_point') else 'unknown'}")
            
            # Debug: Check all node types we're processing
            if node.type == 'string' or node.type == 'jsx_text':
                # Get the actual string content
                if node.type == 'string':
                    text = node.text.decode('utf-8').strip('"\'`')
                else:  # jsx_text
                    text = node.text.decode('utf-8').strip()
                
                # Skip empty strings
                if not text:
                    return
                
                # Skip very short strings (likely not UI text)
                if len(text) < 2:
                    return
                
                # Get context information
                parent = node.parent
                grandparent = parent.parent if parent else None
                
                # Debug: Check if this is Connect Github before processing
                if 'Connect Github' in text:
                    print(f"DEBUG: Processing 'Connect Github' as {node.type} at line {node.start_point[0] + 1}")
                    print(f"DEBUG: Raw text: '{node.text.decode('utf-8')}'")
                    print(f"DEBUG: Stripped text: '{text}'")
                
                # Debug: Check if we found the Connect Github string
                if text == 'Connect Github':
                    print(f"DEBUG: Found 'Connect Github' {node.type} at line {node.start_point[0] + 1}")
                    print(f"DEBUG: Connect Github text: '{text}'")
                    print(f"DEBUG: Connect Github parent: {parent.type if parent else 'None'}")
                    print(f"DEBUG: Connect Github grandparent: {grandparent.type if grandparent else 'None'}")
                
                context = {
                    'text': text,
                    'file_path': file_path,
                    'line': node.start_point[0] + 1,
                    'column': node.start_point[1] + 1,
                    'node_type': node.type,
                    'parent_type': parent.type if parent else None,
                    'grandparent_type': grandparent.type if grandparent else None,
                    'is_jsx_attribute': self._is_jsx_attribute(node),
                    'is_jsx_text': self._is_jsx_text(node),
                    'attribute_name': self._get_attribute_name(node),
                    'is_aria_attribute': self._is_aria_attribute(node),
                    'is_object_property': self._is_object_property(node),
                    'is_array_element': self._is_array_element(node),
                    'is_button_text': self._is_button_text(node),
                    'is_link_text': self._is_link_text(node),
                    'jsx_tag': self._get_jsx_tag(node),
                }
                
                # Debug: Check if this is Connect Github after context building
                if text == 'Connect Github':
                    print(f"DEBUG: Connect Github context built: {context}")
                    print(f"DEBUG: Connect Github is_jsx_text: {context['is_jsx_text']}")
                    print(f"DEBUG: Connect Github is_button_text: {context['is_button_text']}")
                
                candidates.append(context)
            
            # Recursively traverse children
            for child in node.children:
                traverse(child, depth + 1)
        
        traverse(tree.root_node)
        return candidates
    
    def _is_jsx_attribute(self, node: tree_sitter.Node) -> bool:
        """Check if the string is a JSX attribute value."""
        parent = node.parent
        return parent and parent.type == 'jsx_attribute'
    
    def _is_jsx_text(self, node: tree_sitter.Node) -> bool:
        """Check if the string is JSX text content."""
        if node.type != 'string':
            return False
        
        # Check if this is direct text content inside JSX elements
        current = node.parent
        while current:
            if current.type == 'jsx_element':
                # Check if this is direct text content (not in attributes)
                for child in current.children:
                    if child.type == 'jsx_text' and child == node:
                        return True
            elif current.type == 'jsx_self_closing_element':
                # Check if this is text content in self-closing elements
                for child in current.children:
                    if child.type == 'jsx_text' and child == node:
                        return True
            current = current.parent
        return False
    
    def _has_jsx_parent(self, node: tree_sitter.Node) -> bool:
        """Check if any parent is a JSX element."""
        current = node.parent
        while current:
            if current.type in ['jsx_element', 'jsx_self_closing_element']:
                return True
            current = current.parent
        return False
    
    def _get_attribute_name(self, node: tree_sitter.Node) -> Optional[str]:
        """Get the name of the JSX attribute this string belongs to."""
        parent = node.parent
        if parent and parent.type == 'jsx_attribute':
            # Find the attribute name
            for child in parent.children:
                if child.type == 'property_identifier':
                    return child.text.decode('utf-8')
        return None
    
    def _is_aria_attribute(self, node: tree_sitter.Node) -> bool:
        """Check if this is an aria-* attribute."""
        attr_name = self._get_attribute_name(node)
        return attr_name and attr_name.startswith('aria-')
    
    def _is_object_property(self, node: tree_sitter.Node) -> bool:
        """Check if the string is a value in an object property."""
        parent = node.parent
        if not parent or parent.type != 'pair':
            return False
        
        # Debug: Check what we're looking at
        text = node.text.decode('utf-8')
        if text == 'Admin':
            print(f"DEBUG: Found 'Admin' string, parent type: {parent.type}")
            print(f"DEBUG: Parent children: {[child.type for child in parent.children]}")
            for child in parent.children:
                if child.type == 'property_identifier':
                    prop_name = child.text.decode('utf-8')
                    print(f"DEBUG: Property name: '{prop_name}'")
        
        # Check if this is a UI-relevant property like 'text', 'label', 'title', etc.
        for child in parent.children:
            if child.type == 'property_identifier' and child.text.decode('utf-8') in ['text', 'label', 'title', 'alt', 'placeholder']:
                return True
        
        return False
    
    def _is_array_element(self, node: tree_sitter.Node) -> bool:
        """Check if the string is an element in an array."""
        parent = node.parent
        return parent and parent.type == 'array'
    
    def _is_button_text(self, node: tree_sitter.Node) -> bool:
        """Check if the string is text content inside a Button component."""
        current = node.parent
        while current:
            if current.type == 'jsx_element':
                # Check if this is a Button component
                for child in current.children:
                    if child.type == 'jsx_opening_element':
                        for grandchild in child.children:
                            if grandchild.type == 'identifier' and grandchild.text.decode('utf-8') == 'Button':
                                return True
            elif current.type == 'jsx_self_closing_element':
                # Check if this is a Button component
                for child in current.children:
                    if child.type == 'identifier' and child.text.decode('utf-8') == 'Button':
                        return True
            current = current.parent
        return False
    
    def _is_link_text(self, node: tree_sitter.Node) -> bool:
        """Check if the string is text content inside a Link component."""
        current = node.parent
        while current:
            if current.type == 'jsx_element':
                # Check if this is a Link component
                for child in current.children:
                    if child.type == 'jsx_opening_element':
                        for grandchild in child.children:
                            if grandchild.type == 'identifier' and grandchild.text.decode('utf-8') == 'Link':
                                return True
            elif current.type == 'jsx_self_closing_element':
                # Check if this is a Link component
                for child in current.children:
                    if child.type == 'identifier' and child.text.decode('utf-8') == 'Link':
                        return True
            current = current.parent
        return False
    
    def _get_jsx_tag(self, node: tree_sitter.Node) -> str:
        """Get the JSX tag name that contains this string."""
        current = node.parent
        while current:
            if current.type == 'jsx_element':
                # Find the opening tag
                for child in current.children:
                    if child.type == 'jsx_opening_element':
                        for grandchild in child.children:
                            if grandchild.type == 'identifier':
                                return grandchild.text.decode('utf-8')
            elif current.type == 'jsx_self_closing_element':
                # Find the tag name
                for child in current.children:
                    if child.type == 'identifier':
                        return child.text.decode('utf-8')
            current = current.parent
        
        # Check if it's in an object property (like menu options)
        if self._is_object_property(node):
            return 'object_property'
        
        # Check if it's in an array
        if self._is_array_element(node):
            return 'array_element'
        
        return 'unknown'
    
    def get_code_context(self, tree: tree_sitter.Tree, node: tree_sitter.Node, file_content: str, lines_before: int = 3, lines_after: int = 3) -> str:
        """Get code context around a node for LLM analysis."""
        start_line = max(0, node.start_point[0] - lines_before)
        end_line = min(len(file_content.split('\n')), node.end_point[0] + lines_after + 1)
        
        lines = file_content.split('\n')
        context_lines = lines[start_line:end_line]
        
        # Add line numbers
        context = []
        for i, line in enumerate(context_lines):
            line_num = start_line + i + 1
            marker = ">>> " if start_line + i == node.start_point[0] else "    "
            context.append(f"{marker}{line_num:3d}: {line}")
        
        return '\n'.join(context)


class FileScanner:
    """Scans files matching include/exclude patterns."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.include_spec = PathSpec.from_lines('gitwildmatch', config.get('include_patterns', []))
        self.exclude_spec = PathSpec.from_lines('gitwildmatch', config.get('exclude_patterns', []))
    
    def find_files(self, root_dir: str) -> List[str]:
        """Find all files matching include patterns but not exclude patterns."""
        files = []
        
        for root, dirs, filenames in os.walk(root_dir):
            # Skip excluded directories
            rel_root = os.path.relpath(root, root_dir)
            if rel_root == '.':
                rel_root = ''
            
            for filename in filenames:
                if not filename.endswith(('.jsx', '.js')):
                    continue
                
                file_path = os.path.join(rel_root, filename) if rel_root else filename
                full_path = os.path.join(root, filename)
                
                # Check include patterns
                if not self.include_spec.match_file(file_path):
                    continue
                
                # Check exclude patterns
                if self.exclude_spec.match_file(file_path):
                    continue
                
                files.append(full_path)
        
        return files
