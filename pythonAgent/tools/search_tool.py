"""
Search tool for discovering React/JSX files in the project.
"""

import re
from pathlib import Path
from typing import List, Set

from tools.base_tool import BaseTool


class SearchTool(BaseTool):
    """Tool for discovering React/JSX files that need internationalization."""
    
    def __init__(self, agent):
        """Initialize the search tool."""
        super().__init__(agent)
        self.test_mode = getattr(agent, 'test_mode', False)
    
    async def execute(self) -> dict:
        """
        Execute the search tool to discover React files.
        
        Returns:
            Dictionary with search results
        """
        self.log('Discovering React files...')
        
        # Get files from agent's memory/state
        state = self.agent.state_manager.get_state()
        targets = state.context.files_to_process
        
        # If no files in memory, discover them
        if not targets or len(targets) == 0:
            self.log('  No files in memory, discovering JSX files...')
            targets = await self._discover_jsx_files()
            
            # Store files in agent's memory and update phase
            self.agent.state_manager.update_context({
                'files_to_process': targets
            })
            
            self.agent.state_manager.update_state({
                'phase': 'searching'
            })
            
            self.log(f'  Stored {len(targets)} files in agent memory')
        else:
            self.log(f'  Using {len(targets)} files from agent memory')
        
        return {
            'files_discovered': len(targets),
            'files': targets
        }
    
    def _is_translatable(self, text: str) -> bool:
        """
        Check if a text string should be translated.
        
        Args:
            text: The text to check
            
        Returns:
            True if the text should be translated
        """
        # Skip very short strings, numbers, variables, etc.
        if len(text) < 2:
            return False
        if re.match(r'^\d+$', text):
            return False
        if re.match(r'^[A-Z_]+$', text):
            return False  # Constants
        if '${' in text or '{{' in text:
            return False  # Template literals
        if text.startswith('/') and '/' in text[1:]:
            return False  # Routes
        if 'className' in text or 'id=' in text:
            return False  # HTML attributes
        
        # Skip CSS values and HTML attributes
        css_values = {
            'row', 'column', 'center', 'space-around', 'space-between',
            'flex-start', 'flex-end', 'true', 'false', 'auto', 'none',
            'block', 'inline', 'flex'
        }
        if text in css_values:
            return False
        
        if '-' in text and ' ' not in text:
            return False  # CSS classes and IDs
        if re.match(r'^[a-z-]+$', text):
            return False  # CSS values like "simple-menu"
        
        # Skip HTML IDs and technical identifiers
        if 'menu' in text and '-' in text:
            return False  # "simple-menu", "wrappingLink"
        if 'snackbar' in text or 'message' in text:
            return False  # Technical IDs
        
        return True
    
    async def _discover_jsx_files(self) -> List[str]:
        """
        Discover JSX files in the project.
        
        Returns:
            List of file paths
        """
        jsx_files = []
        
        # Check if we're in test mode (only search test-i18n folder)
        search_dirs = ['test-i18n'] if self.test_mode else [
            'components',
            'pages',
            'src',
            'lib',
            'server'
        ]
        
        for dir_name in search_dirs:
            dir_path = Path(dir_name)
            if dir_path.exists():
                files = self._find_jsx_files_in_dir(dir_path)
                jsx_files.extend(files)
        
        self.log(f'  Discovered {len(jsx_files)} JSX files')
        return jsx_files
    
    def _find_jsx_files_in_dir(self, dir_path: Path, base_path: Path = None) -> List[str]:
        """
        Recursively find JSX files in a directory.
        
        Args:
            dir_path: Directory to search
            base_path: Base path for relative file paths
            
        Returns:
            List of file paths
        """
        files = []
        
        if not dir_path.exists():
            return files
        
        # Skip common directories that shouldn't be searched
        skip_dirs = {'node_modules', '.next', '.git', 'backups', '__pycache__', '.venv', 'venv'}
        
        try:
            for item in dir_path.iterdir():
                if item.is_dir():
                    # Skip common directories
                    if item.name in skip_dirs:
                        continue
                    # Recursively search subdirectories
                    sub_files = self._find_jsx_files_in_dir(item, base_path)
                    files.extend(sub_files)
                elif item.is_file() and (item.suffix == '.jsx' or item.suffix == '.js'):
                    # Check if it's a React component (contains JSX)
                    try:
                        content = item.read_text(encoding='utf-8')
                        if self._is_react_component(content):
                            # Convert to relative path from project root
                            try:
                                relative_path = str(item.relative_to(Path.cwd()))
                            except ValueError:
                                # If the file is not relative to cwd, use the path as-is
                                relative_path = str(item)
                            files.append(relative_path)
                    except Exception:
                        # Skip files that can't be read
                        continue
        except Exception as error:
            self.warn(f'Error reading directory {dir_path}: {error}')
        
        return files
    
    def _is_react_component(self, content: str) -> bool:
        """
        Check if file content is a React component.
        
        Args:
            content: File content to check
            
        Returns:
            True if it's a React component
        """
        # Check for JSX syntax patterns
        jsx_patterns = [
            r'<[A-Z][a-zA-Z0-9]*',  # JSX element starting with capital letter
            r'<[a-z][a-zA-Z0-9]*',  # JSX element starting with lowercase
            r'</[A-Za-z]',           # Closing JSX element
            r'className\s*=',        # className attribute
            r'onClick\s*=',          # onClick attribute
            r'return\s*\(',          # return statement with parentheses
            r'import.*from.*[\'"]react[\'"]'  # React import
        ]
        
        return any(re.search(pattern, content) for pattern in jsx_patterns)
