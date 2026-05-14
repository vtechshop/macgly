const router = require('express').Router();
const { chat } = require('../services/openaiService');
const { authLimiter } = require('../middleware/rateLimiter');

// Rate limit chatbot: 20 messages/minute per IP
router.post('/', authLimiter, async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: { message: 'Message required' } });
    const reply = await chat(history || [], message.trim());
    res.json({ reply });
  } catch (err) { next(err); }
});

module.exports = router;
