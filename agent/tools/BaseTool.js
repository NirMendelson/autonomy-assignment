const Anthropic = require('@anthropic-ai/sdk');

class BaseTool {
  constructor(agent) {
    this.agent = agent;
    this.anthropic = agent.anthropic;
  }

  async askClaude(prompt, maxTokens = 4000) {
    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }]
      });
      return response.content[0].text;
    } catch (error) {
      console.error('❌ Claude API error:', error.message);
      throw error;
    }
  }

  log(message) {
    console.log(`  ${message}`);
  }

  error(message) {
    console.error(`  ❌ ${message}`);
  }

  success(message) {
    console.log(`  ✅ ${message}`);
  }
}

module.exports = BaseTool;
