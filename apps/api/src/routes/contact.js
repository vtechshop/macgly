const router = require('express').Router();
const AppError = require('../utils/AppError');
const { sendContactMessage } = require('../services/emailService');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/', authLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
      throw new AppError('Name, email, and message are required', 400, 'MISSING_FIELDS');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Invalid email address', 400, 'INVALID_EMAIL');
    }
    if (message.length > 2000) {
      throw new AppError('Message too long (max 2000 characters)', 400, 'MESSAGE_TOO_LONG');
    }
    await sendContactMessage({ name: name.trim(), email: email.trim(), phone: phone?.trim(), message: message.trim() });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
