const axios = require('axios');

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

const SYSTEM_PROMPT = `You are a helpful customer support assistant for Macgly, an online marketplace for industrial tools, machinery, and hardware.
Help customers with:
- Finding the right tools/machinery for their needs
- Order tracking and returns
- Product information, warranty, and specifications
- Technical questions about tools
- Account and payment issues

Keep responses concise (2-4 sentences max). If you can't help, direct them to support@macgly.com.
Always be friendly and professional. You can answer in Hindi or Tamil if the user writes in those languages.`;

async function chat(messages, userMessage) {
  if (!OPENAI_KEY) {
    return "I'm the Macgly assistant! Our team is available at support@macgly.com for personalized help with tools, orders, and more.";
  }

  const history = (messages || []).slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data.choices?.[0]?.message?.content || 'Sorry, I could not process that. Please try again.';
}

module.exports = { chat };
