const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '.i18n-agent';
const TARGETS_FILE = path.join(OUTPUT_DIR, 'targets.json');
const CANDIDATES_FILE = path.join(OUTPUT_DIR, 'candidates.json');

// Improved patterns to identify user-facing strings
const STRING_PATTERNS = [
  // JSX text content (improved)
  { pattern: />\s*([^<>\n{]+?)\s*</g, type: 'jsx-text' },
  // JSX text content (more permissive for complex JSX)
  { pattern: />\s*([^<{]+?)\s*</g, type: 'jsx-text-complex' },
  // String literals in JSX attributes
  { pattern: /(title|alt|placeholder|aria-label|aria-describedby)="([^"]+)"/g, type: 'jsx-attr' },
  { pattern: /(title|alt|placeholder|aria-label|aria-describedby)='([^']+)'/g, type: 'jsx-attr' },
  // label prop in TextField/Input
  { pattern: /label\s*=\s*"([^"]+)"|label\s*=\s*'([^']+)'/g, type: 'jsx-label' },
  // notify() calls
  { pattern: /notify\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'notify' },
  // Meta content
  { pattern: /content\s*=\s*["']([^"']+)["']/g, type: 'meta-content' },
  // Title tags
  { pattern: /<title[^>]*>\s*([^<]+?)\s*<\/title>/gs, type: 'title' },
  // Button text (improved)
  { pattern: /<Button[^>]*>\s*([^<{]+?)\s*<\/Button>/gs, type: 'button-text' },
  // Span text
  { pattern: /<span[^>]*>\s*([^<{]+?)\s*<\/span>/gs, type: 'span-text' },
  // Paragraph text
  { pattern: /<p[^>]*>\s*([^<{]+?)\s*<\/p>/gs, type: 'paragraph-text' },
  // Menu item text
  { pattern: /<MenuItem[^>]*>\s*([^<{]+?)\s*<\/MenuItem>/gs, type: 'menu-item' },
  // Emphasis text
  { pattern: /<em[^>]*>\s*([^<{]+?)\s*<\/em>/gs, type: 'emphasis' },
  // JSX element text content
  { pattern: /<[A-Z][a-zA-Z0-9]*[^>]*>\s*([^<{]+?)\s*<\/[A-Z][a-zA-Z0-9]*>/g, type: 'jsx-element-text' },
  // Object properties with string values
  { pattern: /text:\s*['"`]([^'"`]+)['"`]/g, type: 'object-text' },
  // Alt attributes
  { pattern: /alt\s*=\s*["']([^"']+)["']/g, type: 'alt-text' },
  // Link text content
  { pattern: /<Link[^>]*>\s*([^<{]+?)\s*<\/Link>/gs, type: 'link-text' },
  // Template literals with user-facing text
  { pattern: /`([^`]*\$\{[^}]+\}[^`]*)`/g, type: 'template-literal' },
  // Aria attributes
  { pattern: /aria-[^=]*="([^"]+)"/g, type: 'aria-attr' },
  // Multiline JSX text content
  { pattern: /<[a-zA-Z][^>]*>\s*\n\s*([^<{]+?)\s*\n\s*<\/[a-zA-Z][^>]*>/gs, type: 'jsx-multiline-text' },
];

// Improved exclusion patterns - be more selective
const EXCLUDE_PATTERNS = [
  /^\d+$/,                    // Numbers only
  /^[a-zA-Z0-9_-]{1,2}$/,     // Very short identifiers (1-2 chars)
  /^[^a-zA-Z]*$/,             // No letters
  /^[{}()\[\].,;:!?]+$/,      // Only punctuation
  // Exclude specific non-user-facing patterns
  /^\)\s*:\s*null\}/,         // Code syntax like ") : null}"
  /^=\s*0\s*&&\s*/,           // Code logic like "= 0 &&"
  /^\([^)]*\)\s*=>/,          // Arrow function syntax like "(props) =>"
  // Exclude CSS values
  /^#[0-9a-fA-F]{6}$/,        // Hex colors like "#1976D2"
  /^width=device-width/,      // Meta viewport
  // Exclude very short strings (1-2 chars only)
  /^[a-zA-Z0-9\s\-_.,!?]{1,2}$/,  // Very short strings (1-2 chars)
];

function isExcluded(text) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(text));
}

function extractStrings(content, filePath) {
  const phrases = [];
  const phraseMap = new Map();
  
  // Process multiline patterns first (on entire content)
  STRING_PATTERNS.forEach(({ pattern, type }) => {
    if (pattern.flags && pattern.flags.includes('s')) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1] || match[2] || match[3];
        if (text && text.trim() && !isExcluded(text.trim())) {
          const trimmedText = text.trim();
          if (!phraseMap.has(trimmedText)) {
            phraseMap.set(trimmedText, {
              phrase: trimmedText,
              suggestedKey: generateKey(trimmedText, type, filePath),
              occurrences: []
            });
          }
          
          // Calculate line and column for multiline matches
          const beforeMatch = content.substring(0, match.index);
          const lines = beforeMatch.split('\n');
          const line = lines.length;
          const column = lines[lines.length - 1].length + 1;
          
          phraseMap.get(trimmedText).occurrences.push({
            line,
            column,
            type
          });
        }
      }
    }
  });
  
  // Process single-line patterns (line by line)
  const lines = content.split('\n');
  lines.forEach((line, lineIndex) => {
    STRING_PATTERNS.forEach(({ pattern, type }) => {
      if (!pattern.flags || !pattern.flags.includes('s')) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const text = match[1] || match[2] || match[3];
          if (text && text.trim() && !isExcluded(text.trim())) {
            const trimmedText = text.trim();
            if (!phraseMap.has(trimmedText)) {
              phraseMap.set(trimmedText, {
                phrase: trimmedText,
                suggestedKey: generateKey(trimmedText, type, filePath),
                occurrences: []
              });
            }
            
            phraseMap.get(trimmedText).occurrences.push({
              line: lineIndex + 1,
              column: match.index + 1,
              type
            });
          }
        }
      }
    });
  });
  
  return Array.from(phraseMap.values());
}

function generateKey(text, type, filePath) {
  const cleanText = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
  
  const filePrefix = filePath
    .replace(/\\/g, '_')
    .replace(/\.jsx?$/, '')
    .replace(/[^a-z0-9_]/gi, '_')
    .toLowerCase();
  
  return `${type}_${filePrefix}_${cleanText}`;
}

function main() {
  console.log('🔍 Stage 2: Finding hardcoded phrases (IMPROVED)...');
  
  if (!fs.existsSync(TARGETS_FILE)) {
    console.error('❌ Targets file not found. Run "npm run i18n:decide-targets" first.');
    process.exit(1);
  }
  
  const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
  console.log(`📋 Processing ${targets.length} target files...`);
  
  const results = {};
  let totalPhrases = 0;
  let filesWithPhrases = 0;
  
  targets.forEach(target => {
    if (fs.existsSync(target)) {
      const content = fs.readFileSync(target, 'utf8');
      const phrases = extractStrings(content, target);
      
      if (phrases.length > 0) {
        results[target] = {
          file: target,
          phrases: phrases
        };
        totalPhrases += phrases.length;
        filesWithPhrases++;
        console.log(`📄 ${target}: Found ${phrases.length} strings`);
      } else {
        console.log(`📄 ${target}: Found 0 strings`);
      }
    } else {
      console.log(`📄 ${target}: File not found`);
    }
  });
  
  console.log(`\n📊 Found ${totalPhrases} total strings`);
  console.log(`📊 Files with phrases: ${filesWithPhrases}`);
  
  // Show examples
  console.log('\n📝 Example phrases by file:');
  Object.entries(results).slice(0, 3).forEach(([file, data], index) => {
    console.log(`   ${index + 1}. ${file} (${data.phrases.length} phrases)`);
    data.phrases.slice(0, 3).forEach((phrase, i) => {
      console.log(`      ${i + 1}. "${phrase.phrase}" → ${phrase.suggestedKey}`);
    });
    if (data.phrases.length > 3) {
      console.log(`      ... and ${data.phrases.length - 3} more`);
    }
  });
  
  // Save results
  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ Candidates saved to: ${CANDIDATES_FILE}`);
  console.log(`\n🎉 Stage 2 complete! Found ${Object.keys(results).length} unique phrases.`);
}

main();
