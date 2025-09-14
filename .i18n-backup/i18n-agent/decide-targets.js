const fs = require('fs');
const path = require('path');

/**
 * Stage 1: Decide Targets
 * Scans repository to identify frontend/UI files that need i18n processing
 */

const OUTPUT_DIR = '.i18n-agent';
const TARGETS_FILE = path.join(OUTPUT_DIR, 'targets.json');

// File patterns to include (frontend files)
const INCLUDE_PATTERNS = [
  /\.jsx?$/,           // React components
  /\.tsx?$/,           // TypeScript React components
  /\.vue$/,            // Vue components
  /\.svelte$/,         // Svelte components
];

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.coverage',
  'venv',
  '__pycache__',
  '.i18n-backup',
  '.i18n-agent',       // i18n agent files
  '.agent_backups',    // Agent backup files
  'test',
  'tests',
  'spec',
  'specs',
  '__tests__',
  'server',            // Backend files
  'api',               // API routes
  'models',            // Database models
  'utils',             // Utility functions (usually backend)
  'lib/api',           // API utilities
  'lib/notify',        // Notification utilities
  'lib/theme',         // Theme utilities
  'lib/withAuth',      // Auth utilities
];

// File patterns to exclude
const EXCLUDE_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\.stories\./,
  /\.config\./,
  /\.env/,
  /package\.json$/,
  /yarn\.lock$/,
  /\.lock$/,
  /\.log$/,
  /\.md$/,
  /\.txt$/,
  /\.css$/,
  /\.scss$/,
  /\.sass$/,
  /\.less$/,
  /\.json$/,
  /\.xml$/,
  /\.yml$/,
  /\.yaml$/,
  /\.toml$/,
  /\.ini$/,
  /\.conf$/,
  /\.gitignore$/,
  /\.eslintrc/,
  /\.prettierrc/,
  /\.babelrc/,
  /\.editorconfig/,
  /\.dockerignore/,
  /\.nvmrc/,
  /\.node-version/,
  /\.python-version/,
  /\.ruby-version/,
  /\.gitattributes/,
  /\.gitmodules/,
  /\.travis\.yml/,
  /\.github/,
  /\.vscode/,
  /\.idea/,
  /\.DS_Store/,
  /Thumbs\.db/,
];

/**
 * Check if a file should be included based on patterns
 */
function shouldIncludeFile(filePath) {
  // Check include patterns
  const hasIncludePattern = INCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
  if (!hasIncludePattern) return false;

  // Check exclude patterns
  const hasExcludePattern = EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
  if (hasExcludePattern) return false;

  return true;
}

/**
 * Check if a directory should be excluded
 */
function shouldExcludeDir(dirPath) {
  const relativePath = path.relative(process.cwd(), dirPath);
  return EXCLUDE_DIRS.some(excludeDir => 
    relativePath === excludeDir || 
    relativePath.startsWith(excludeDir + path.sep)
  );
}

/**
 * Check if file contains React/JSX content
 */
function hasReactContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Must have React import OR be a .jsx/.tsx file
    const hasReactImport = /import.*react/i.test(content) || 
                          /from\s+['"]react['"]/i.test(content) ||
                          /import\s+React/i.test(content);
    
    // Check for JSX syntax (more strict)
    const hasJSX = /<[A-Z][a-zA-Z0-9]*/.test(content) || 
                  /<[a-z][a-zA-Z0-9-]*[^>]*>/.test(content) ||
                  /<\/[A-Z]/.test(content);
    
    // Check for React hooks
    const hasHooks = /useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef|useLayoutEffect/i.test(content);
    
    // Check for component patterns
    const hasComponent = /function\s+\w+\s*\(|const\s+\w+\s*=\s*\(|class\s+\w+\s+extends/i.test(content);
    
    // Check for Next.js specific patterns
    const hasNextJS = /from\s+['"]next\//i.test(content) || 
                     /import.*next/i.test(content) ||
                     /getServerSideProps|getStaticProps|getInitialProps/i.test(content);
    
    // For .jsx/.tsx files, be more lenient
    const isJSXFile = /\.(jsx|tsx)$/.test(filePath);
    
    if (isJSXFile) {
      return hasReactImport || hasJSX || hasHooks || hasComponent || hasNextJS;
    }
    
    // For .js/.ts files, be more strict
    return (hasReactImport && (hasJSX || hasHooks || hasComponent)) || hasNextJS;
  } catch (error) {
    return false;
  }
}

/**
 * Scan directory recursively for target files
 */
function scanDirectory(dirPath, targets = []) {
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip excluded directories
        if (shouldExcludeDir(fullPath)) {
          console.log(`⏭️  Skipping directory: ${fullPath}`);
          continue;
        }
        
        // Recursively scan subdirectory
        scanDirectory(fullPath, targets);
      } else if (stat.isFile()) {
        // Check if file should be included
        if (shouldIncludeFile(fullPath)) {
          // Additional check: does it contain React/JSX content?
          if (hasReactContent(fullPath)) {
            const relativePath = path.relative(process.cwd(), fullPath);
            targets.push(relativePath);
            console.log(`✅ Found target: ${relativePath}`);
          } else {
            console.log(`⏭️  Skipping (no React content): ${fullPath}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error scanning directory ${dirPath}:`, error.message);
  }
  
  return targets;
}

/**
 * Main function to decide targets
 */
async function decideTargets() {
  try {
    console.log('🔍 Stage 1: Deciding targets...');
    
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Start scanning from current directory
    const targets = scanDirectory(process.cwd());
    
    // Remove duplicates and sort
    const uniqueTargets = [...new Set(targets)].sort();
    
    // Save targets to file
    fs.writeFileSync(TARGETS_FILE, JSON.stringify(uniqueTargets, null, 2));
    
    console.log(`\n📋 Found ${uniqueTargets.length} target files:`);
    uniqueTargets.forEach((target, index) => {
      console.log(`   ${index + 1}. ${target}`);
    });
    
    console.log(`\n✅ Targets saved to: ${TARGETS_FILE}`);
    
    return {
      success: true,
      targets: uniqueTargets,
      count: uniqueTargets.length
    };
    
  } catch (error) {
    console.error('❌ Error deciding targets:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get current targets
 */
function getTargets() {
  try {
    if (fs.existsSync(TARGETS_FILE)) {
      return JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
    }
    return [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  decideTargets,
  getTargets,
  shouldIncludeFile,
  shouldExcludeDir,
  hasReactContent
};

// CLI usage
if (require.main === module) {
  decideTargets().then(result => {
    if (result.success) {
      console.log(`\n🎉 Stage 1 complete! Found ${result.count} target files.`);
      process.exit(0);
    } else {
      console.error(`\n💥 Stage 1 failed: ${result.error}`);
      process.exit(1);
    }
  });
}
