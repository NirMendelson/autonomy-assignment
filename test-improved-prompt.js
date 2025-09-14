require('dotenv').config();
const fs = require('fs');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testImprovedPrompt() {
  console.log('🧪 Testing improved prompt on MenuWithAvatar.jsx...\n');
  
  // Test with MenuWithAvatar.jsx (the problematic file)
  const testFile = 'components/MenuWithAvatar.jsx';
  const content = fs.readFileSync(testFile, 'utf8');
  
  const prompt = `You are an expert at internationalization (i18n) for React/Next.js applications. 

Analyze the following React/JSX file and identify ALL hardcoded user-facing strings that need to be translated. 

CRITICAL RULES - FOLLOW EXACTLY:
1. ONLY include strings that are VISIBLE TO END USERS (UI text, labels, messages, notifications, etc.)
2. DO NOT include:
   - HTML IDs (like "simple-menu", "wrappingLink", "snackbar-message-id") - even if they appear in JSX
   - CSS classes or technical identifiers
   - Code logic (like "err.message || err.toString()")
   - Template literals with only variables (like "\${variable}")
   - Console.log messages or debug text
   - Error handling code that users don't see
   - Any text that appears in id="..." attributes
   - Any text that appears in className="..." attributes
   - Any text that appears in data-* attributes
3. DO include:
   - Button text, link text, form labels
   - Notify messages (like "Saved", "Synced", "Name is required")
   - Page titles, headings, descriptions
   - Alt text for images
   - User-facing template literals (like "Buy book for $\${price}")
   - Menu items, navigation text
4. For each string, provide the exact text as it appears in the code
5. Generate semantic translation keys using dot notation (e.g., "button.save", "menu.my_books", "error.name_required")
6. Provide accurate line and column numbers where the string appears

EXAMPLES OF GOOD KEYS:
- "Save" → "button.save"
- "My books" → "menu.my_books" 
- "Name is required" → "error.name_required"
- "Buy book for $\${price}" → "button.buy_book_for_price"

EXAMPLES OF WHAT TO EXCLUDE:
- "simple-menu" (HTML ID in id="simple-menu")
- "wrappingLink" (HTML ID in id="wrappingLink") 
- "snackbar-message-id" (HTML ID in id="snackbar-message-id")
- "option.text" (code reference, not user text)
- "" (empty string)
- "err.message || err.toString()" (code logic)
- Any text inside id="...", className="...", data-*="..." attributes

Return your analysis as a JSON object with this exact structure:
{
  "file": "file/path/here",
  "phrases": [
    {
      "phrase": "exact text as it appears",
      "suggestedKey": "semantic.translation.key",
      "occurrences": [
        {
          "line": 42,
          "column": 15,
          "type": "jsx-text"
        }
      ]
    }
  ]
}

File to analyze:
${testFile}

File content:
\`\`\`jsx
${content}
\`\`\`

Analyze this file and return the JSON:`;

  try {
    console.log('🤖 Sending request to GPT-4o-mini...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at internationalization (i18n) for React/Next.js applications. Always respond with valid JSON only. Follow the exclusion rules EXACTLY."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const response = completion.choices[0].message.content.trim();
    console.log('📝 GPT Response:');
    console.log(response);
    
    // Try to extract JSON from the response
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log('\n✅ Successfully parsed JSON:');
      console.log(JSON.stringify(result, null, 2));
      
      // Check for false positives
      const falsePositives = result.phrases.filter(p => 
        p.phrase === 'simple-menu' || 
        p.phrase === 'wrappingLink' || 
        p.phrase === 'option.text' ||
        p.phrase === ''
      );
      
      if (falsePositives.length > 0) {
        console.log('\n❌ FALSE POSITIVES FOUND:');
        falsePositives.forEach(fp => console.log(`  - "${fp.phrase}" → ${fp.suggestedKey}`));
      } else {
        console.log('\n✅ NO FALSE POSITIVES - Perfect!');
      }
    } else {
      console.log('\n❌ No valid JSON found in response');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImprovedPrompt().catch(console.error);
