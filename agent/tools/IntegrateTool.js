const BaseTool = require('./BaseTool');
const fs = require('fs');
const path = require('path');

class IntegrateTool extends BaseTool {
  async execute() {
    this.log('🔗 Integrating i18n into Next.js app...');
    
    const results = {
      filesModified: 0,
      integrationComplete: false,
      files: {}
    };
    
    try {
      // 1. Update pages/_app.jsx to include i18n
      const appFilePath = path.join(process.cwd(), 'pages', '_app.jsx');
      
      if (fs.existsSync(appFilePath)) {
        this.log(`  📄 Updating ${appFilePath}...`);
        
        let appContent = fs.readFileSync(appFilePath, 'utf8');
        
        // Check if already integrated
        if (appContent.includes('I18nProvider') && appContent.includes('lib/i18n')) {
          this.log(`  ✅ App already integrated with i18n`);
          results.integrationComplete = true;
        } else {
          // Add i18n imports
          const importLines = [
            "import I18nProvider from '../components/I18nProvider';",
            "import '../lib/i18n'; // Initialize i18n"
          ];
          
          // Find the last import statement
          const importRegex = /^import\s+.*?;$/gm;
          const imports = appContent.match(importRegex) || [];
          const lastImportIndex = appContent.lastIndexOf(imports[imports.length - 1]) + imports[imports.length - 1].length;
          
          // Insert new imports after the last import
          const beforeImports = appContent.substring(0, lastImportIndex);
          const afterImports = appContent.substring(lastImportIndex);
          
          appContent = beforeImports + '\n' + importLines.join('\n') + afterImports;
          
          // Wrap the return statement with I18nProvider
          const returnRegex = /return\s*\(\s*<CacheProvider/g;
          if (returnRegex.test(appContent)) {
            appContent = appContent.replace(
              /return\s*\(\s*<CacheProvider/g,
              'return (\n    <I18nProvider>\n      <CacheProvider'
            );
            
            // Close the I18nProvider tag
            const closingRegex = /<\/CacheProvider>\s*\);/g;
            appContent = appContent.replace(
              closingRegex,
              '</CacheProvider>\n    </I18nProvider>\n  );'
            );
          }
          
          // Write the updated file
          fs.writeFileSync(appFilePath, appContent);
          this.log(`  ✅ Successfully integrated i18n into _app.jsx`);
          results.filesModified++;
          results.files[appFilePath] = 'integrated';
          results.integrationComplete = true;
        }
      } else {
        this.log(`  ❌ _app.jsx not found at ${appFilePath}`);
      }
      
      // 2. Create a language switcher component (optional)
      const switcherPath = path.join(process.cwd(), 'components', 'LanguageSwitcher.jsx');
      
      if (!fs.existsSync(switcherPath)) {
        this.log(`  📄 Creating language switcher component...`);
        
        const switcherContent = `import React from 'react';
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

export default LanguageSwitcher;`;
        
        fs.writeFileSync(switcherPath, switcherContent);
        this.log(`  ✅ Created language switcher component`);
        results.filesModified++;
        results.files[switcherPath] = 'created';
      }
      
      // 3. Add language switcher to Header component
      const headerPath = path.join(process.cwd(), 'components', 'Header.jsx');
      
      if (fs.existsSync(headerPath)) {
        this.log(`  📄 Adding language switcher to Header...`);
        
        let headerContent = fs.readFileSync(headerPath, 'utf8');
        
        // Check if already has language switcher
        if (!headerContent.includes('LanguageSwitcher')) {
          // Add import
          const importMatch = headerContent.match(/import.*from.*react-i18next.*;/);
          if (importMatch) {
            const importIndex = headerContent.lastIndexOf(importMatch[0]) + importMatch[0].length;
            headerContent = headerContent.substring(0, importIndex) + 
              "\nimport LanguageSwitcher from './LanguageSwitcher';" + 
              headerContent.substring(importIndex);
          }
          
          // Add LanguageSwitcher to the JSX (find a good spot in the header)
          const toolbarMatch = headerContent.match(/<Toolbar[^>]*>/);
          if (toolbarMatch) {
            const toolbarIndex = headerContent.lastIndexOf(toolbarMatch[0]) + toolbarMatch[0].length;
            headerContent = headerContent.substring(0, toolbarIndex) + 
              "\n          <LanguageSwitcher />" + 
              headerContent.substring(toolbarIndex);
          }
          
          fs.writeFileSync(headerPath, headerContent);
          this.log(`  ✅ Added language switcher to Header`);
          results.filesModified++;
          results.files[headerPath] = 'updated';
        } else {
          this.log(`  ✅ Header already has language switcher`);
        }
      }
      
      // Store results in agent state
      this.agent.stateManager.updateContext({ integrateResults: results });
      
      // Update phase to indicate integration is complete
      if (results.integrationComplete) {
        this.agent.stateManager.updateState({ phase: 'integration_complete' });
        this.log(`  ✅ Integration phase complete - ${results.filesModified} files modified`);
      }
      
      return results;
      
    } catch (error) {
      this.error(`Integration failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = IntegrateTool;
