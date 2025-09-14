require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testSimple() {
  console.log('🧪 Testing simple GPT-5 request...\n');
  
  try {
    console.log('🤖 Sending simple request...');
    const startTime = Date.now();
    
    const completion = await openai.responses.create({
      model: "gpt-5",
      input: "Say 'Hello World' and return JSON: {\"message\": \"Hello World\"}"
    });
    
    const endTime = Date.now();
    console.log(`⏱️ Request took ${endTime - startTime}ms`);
    console.log('✅ Response:', completion.output_text);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimple().catch(console.error);
