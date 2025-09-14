require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const OUTPUT_DIR = '.i18n-agent';
const TARGETS_FILE = path.join(OUTPUT_DIR, 'targets.json');
const CANDIDATES_FILE = path.join(OUTPUT_DIR, 'candidates-gpt.json');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function analyzeFileWithGPT(filePath, content) {
  const prompt = `Find user-facing text in this React file. Return JSON with phrases array.

Rules:
- Include button text, links, labels, messages users see
- Exclude HTML IDs, CSS classes, code logic
- Generate semantic keys like "button.save", "menu.my_books"

\`\`\`jsx
${content}
\`\`\`

Return: {"file": "${filePath}", "phrases": [{"phrase": "text", "suggestedKey": "key", "occurrences": [{"line": 1, "column": 1, "type": "jsx-text"}]}]}`;

  try {
    console.log(`🔍 Sending request to GPT-5 for ${filePath}...`);
    console.log(`📏 File size: ${content.length} characters`);
    
    const completion = await openai.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    console.log(`📥 Received response from GPT-5 for ${filePath}`);
    const response = completion.output_text.trim();
    console.log(`📝 Response length: ${response.length} characters`);
    
    // Try to extract JSON from the response
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No valid JSON found in response');
    }
  } catch (error) {
    console.error(`❌ Error analyzing ${filePath}:`, error.message);
    return {
      file: filePath,
      phrases: [],
      error: error.message
    };
  }
}

async function main() {
  console.log('🤖 Stage 2 (GPT): Finding hardcoded phrases with AI...');
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not found');
    console.error('Please set your OpenAI API key: export OPENAI_API_KEY=your_key_here');
    process.exit(1);
  }
  
  // Check for targets file
  if (!fs.existsSync(TARGETS_FILE)) {
    console.error('❌ Targets file not found. Run "npm run i18n:decide-targets" first.');
    process.exit(1);
  }
  
  const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
  console.log(`📋 Processing ${targets.length} target files with GPT-5...`);
  
  const results = {};
  let totalPhrases = 0;
  let filesWithPhrases = 0;
  let filesWithErrors = 0;
  
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`\n📄 [${i + 1}/${targets.length}] Analyzing ${target}...`);
    
    if (fs.existsSync(target)) {
      const content = fs.readFileSync(target, 'utf8');
      
      try {
        const analysis = await analyzeFileWithGPT(target, content);
        
        if (analysis.error) {
          filesWithErrors++;
          console.log(`❌ Error: ${analysis.error}`);
        } else if (analysis.phrases && analysis.phrases.length > 0) {
          results[target] = analysis;
          totalPhrases += analysis.phrases.length;
          filesWithPhrases++;
          console.log(`✅ Found ${analysis.phrases.length} strings`);
          
          // Show first few phrases
          analysis.phrases.slice(0, 3).forEach((phrase, idx) => {
            console.log(`   ${idx + 1}. "${phrase.phrase}" → ${phrase.suggestedKey}`);
          });
          if (analysis.phrases.length > 3) {
            console.log(`   ... and ${analysis.phrases.length - 3} more`);
          }
        } else {
          console.log(`📝 No user-facing strings found`);
        }
      } catch (error) {
        filesWithErrors++;
        console.log(`❌ Error: ${error.message}`);
      }
    } else {
      console.log(`❌ File not found`);
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 GPT Analysis Complete:`);
  console.log(`📊 Found ${totalPhrases} total strings`);
  console.log(`📊 Files with phrases: ${filesWithPhrases}`);
  console.log(`📊 Files with errors: ${filesWithErrors}`);
  
  // Show examples
  console.log('\n📝 Example phrases by file:');
  Object.entries(results).slice(0, 3).forEach(([file, data], index) => {
    console.log(`   ${index + 1}. ${file} (${data.phrases.length} phrases)`);
    data.phrases.slice(0, 2).forEach((phrase, i) => {
      console.log(`      ${i + 1}. "${phrase.phrase}" → ${phrase.suggestedKey}`);
    });
    if (data.phrases.length > 2) {
      console.log(`      ... and ${data.phrases.length - 2} more`);
    }
  });
  
  // Save results
  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ GPT candidates saved to: ${CANDIDATES_FILE}`);
  console.log(`\n🎉 Stage 2 (GPT) complete! Found ${Object.keys(results).length} files with phrases.`);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
