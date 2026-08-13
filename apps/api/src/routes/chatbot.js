const router = require('express').Router();
const { chat } = require('../services/openaiService');
const { chatbotLimiter } = require('../middleware/rateLimiter');

const MAX_MSG_LEN     = 1000;
const MAX_HISTORY     = 20;
const MAX_ITEM_LEN    = 500;

// Rate limit chatbot: 30 messages/10 minutes per IP
router.post('/', chatbotLimiter, async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: { message: 'Message required' } });
    if (message.length > MAX_MSG_LEN) return res.status(400).json({ error: { message: `Message too long (max ${MAX_MSG_LEN} characters)` } });

    // Sanitise history: cap count, cap per-item content length, drop unknown roles
    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && typeof m === 'object' && ['user', 'assistant'].includes(m.role))
          .slice(-MAX_HISTORY)
          .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, MAX_ITEM_LEN) }))
      : [];

    const reply = await chat(safeHistory, message.trim());
    res.json({ reply });
  } catch (err) { next(err); }
});

module.exports = router;
