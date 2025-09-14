require('dotenv').config();
const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testHeader() {
  console.log('🧪 Testing GPT-5 with Header.jsx (short prompt)...\n');
  
  const content = fs.readFileSync('components/Header.jsx', 'utf8');
  console.log(`📏 File size: ${content.length} characters`);
  
  // Much shorter prompt
  const prompt = `Find user-facing text in this React file. Return JSON with phrases array:

\`\`\`jsx
${content}
\`\`\`

Return: {"file": "components/Header.jsx", "phrases": []}`;

  try {
    console.log('🤖 Sending request...');
    const startTime = Date.now();
    
    const completion = await openai.responses.create({
      model: "gpt-5",
      input: prompt
    });
    
    const endTime = Date.now();
    console.log(`⏱️ Request took ${endTime - startTime}ms`);
    console.log('✅ Response:', completion.output_text);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testHeader().catch(console.error);
