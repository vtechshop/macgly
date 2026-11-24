const router = require('express').Router();
const AppError = require('../utils/AppError');
const { sendContactMessage } = require('../services/emailService');
const { authLimiter } = require('../middleware/rateLimiter');
const ContactSubmission = require('../models/ContactSubmission');
const { notifyAdmins } = require('../utils/notificationHelper');

router.post('/', authLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      throw new AppError('Name, email, and message are required', 400, 'MISSING_FIELDS');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Invalid email address', 400, 'INVALID_EMAIL');
    }
    if (message.length > 2000) {
      throw new AppError('Message too long (max 2000 characters)', 400, 'MESSAGE_TOO_LONG');
    }
    await Promise.all([
      ContactSubmission.create({ name: name.trim(), email: email.trim(), phone: phone?.trim(), subject: subject?.trim(), message: message.trim() }),
      sendContactMessage({ name: name.trim(), email: email.trim(), phone: phone?.trim(), message: message.trim() }),
    ]);
    // Dashboard bell (and pop-up) for every admin; never blocks the reply.
    const preview = (subject?.trim() || message.trim()).slice(0, 80);
    notifyAdmins({
      type: 'ticket',
      title: 'New contact message',
      message: `${name.trim()}: ${preview}`,
      link: '/dashboard/admin/contact-submissions',
    }).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
