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
            if node.type == 'string':
                # Get the actual string content
                text = node.text.decode('utf-8').strip('"\'`')
                
                # Skip empty strings
                if not text:
                    return
                
                # Skip very short strings (likely not UI text)
                if len(text) < 2:
                    return
                
                # Get context information
                parent = node.parent
                grandparent = parent.parent if parent else None
                
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
                }
                
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
        return node.type == 'string' and self._has_jsx_parent(node)
    
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
