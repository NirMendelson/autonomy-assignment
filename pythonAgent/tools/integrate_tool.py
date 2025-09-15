"""
Integrate tool for integrating i18n into Next.js app.
"""

import re
from pathlib import Path
from typing import Dict, Any
from tools.base_tool import BaseTool


class IntegrateTool(BaseTool):
    """Tool for integrating i18n into the Next.js application."""
    
    async def execute(self) -> dict:
        """Execute the integrate tool."""
        self.log('  Integrating i18n into Next.js app...')
        
        results = {
            'files_modified': 0,
            'integration_complete': False,
            'files': {}
        }
        
        try:
            # 1. Update pages/_app.jsx to include i18n
            app_file_path = Path('pages') / '_app.jsx'
            
            if app_file_path.exists():
                self.log(f'    Updating {app_file_path}...')
                
                app_content = app_file_path.read_text(encoding='utf-8')
                
                # Check if already integrated
                if 'I18nProvider' in app_content and 'lib/i18n' in app_content:
                    self.log('    App already integrated with i18n')
                    results['integration_complete'] = True
                else:
                    # Add i18n imports
                    import_lines = [
                        "import I18nProvider from '../components/I18nProvider';",
                        "import '../lib/i18n'; // Initialize i18n"
                    ]
                    
                    # Find the last import statement
                    import_regex = re.compile(r'^import\s+.*?;$', re.MULTILINE)
                    imports = import_regex.findall(app_content) or []
                    if imports:
                        last_import_index = app_content.rfind(imports[-1]) + len(imports[-1])
                        
                        # Insert new imports after the last import
                        before_imports = app_content[:last_import_index]
                        after_imports = app_content[last_import_index:]
                        
                        app_content = before_imports + '\n' + '\n'.join(import_lines) + after_imports
                    
                    # Wrap the return statement with I18nProvider
                    return_regex = re.compile(r'return\s*\(\s*<CacheProvider')
                    if return_regex.search(app_content):
                        app_content = return_regex.sub(
                            'return (\n    <I18nProvider>\n      <CacheProvider',
                            app_content
                        )
                        
                        # Close the I18nProvider tag
                        closing_regex = re.compile(r'</CacheProvider>\s*\);')
                        app_content = closing_regex.sub(
                            '</CacheProvider>\n    </I18nProvider>\n  );',
                            app_content
                        )
                    
                    # Write the updated file
                    app_file_path.write_text(app_content, encoding='utf-8')
                    self.log('    Successfully integrated i18n into _app.jsx')
                    results['files_modified'] += 1
                    results['files'][str(app_file_path)] = 'integrated'
                    results['integration_complete'] = True
            else:
                self.log(f'    _app.jsx not found at {app_file_path}')
            
            # 2. Create a language switcher component (optional)
            switcher_path = Path('components') / 'LanguageSwitcher.jsx'
            
            if not switcher_path.exists():
                self.log('    Creating language switcher component...')
                
                switcher_content = """import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    handleClose();
  };

  const getCurrentLanguage = () => {
    return i18n.language === 'es' ? 'Español' : 'English';
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outlined"
        size="small"
        sx={{ minWidth: 100 }}
      >
        {getCurrentLanguage()}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem onClick={() => changeLanguage('en')}>English</MenuItem>
        <MenuItem onClick={() => changeLanguage('es')}>Español</MenuItem>
      </Menu>
    </>
  );
};

export default LanguageSwitcher;"""
                
                switcher_path.write_text(switcher_content, encoding='utf-8')
                self.log('    Created language switcher component')
                results['files_modified'] += 1
                results['files'][str(switcher_path)] = 'created'
            
            # 3. Add language switcher to Header component
            header_path = Path('components') / 'Header.jsx'
            
            if header_path.exists():
                self.log('    Adding language switcher to Header...')
                
                header_content = header_path.read_text(encoding='utf-8')
                
                # Check if already has language switcher
                if 'LanguageSwitcher' not in header_content:
                    # Add import
                    import_match = re.search(r'import.*from.*react-i18next.*;', header_content)
                    if import_match:
                        import_index = header_content.rfind(import_match.group(0)) + len(import_match.group(0))
                        header_content = (header_content[:import_index] + 
                                        "\nimport LanguageSwitcher from './LanguageSwitcher';" + 
                                        header_content[import_index:])
                    
                    # Add LanguageSwitcher to the JSX (find a good spot in the header)
                    toolbar_match = re.search(r'<Toolbar[^>]*>', header_content)
                    if toolbar_match:
                        toolbar_index = header_content.rfind(toolbar_match.group(0)) + len(toolbar_match.group(0))
                        header_content = (header_content[:toolbar_index] + 
                                        "\n          <LanguageSwitcher />" + 
                                        header_content[toolbar_index:])
                    
                    header_path.write_text(header_content, encoding='utf-8')
                    self.log('    Added language switcher to Header')
                    results['files_modified'] += 1
                    results['files'][str(header_path)] = 'updated'
                else:
                    self.log('    Header already has language switcher')
            
            # Store results in agent state
            self.agent.state_manager.update_state({'integrate_results': results})
            
            # Update phase to indicate integration is complete
            if results['integration_complete']:
                self.agent.state_manager.update_state({'phase': 'integration_complete'})
                self.log(f'    Integration phase complete - {results["files_modified"]} files modified')
            
            return results
            
        except Exception as error:
            self.error(f'Integration failed: {error}')
            raise error
