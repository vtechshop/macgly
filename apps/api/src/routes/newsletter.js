const router = require('express').Router();
const Newsletter = require('../models/Newsletter');
const AppError = require('../utils/AppError');

// Subscribe
router.post('/subscribe', async (req, res, next) => {
  try {
    const { email, name, source } = req.body;
    if (!email) throw new AppError('Email required', 400, 'MISSING_FIELDS');
    await Newsletter.findOneAndUpdate(
      { email: email.toLowerCase() },
      { name, source: source || 'website', isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ message: 'Subscribed successfully' });
  } catch (err) { next(err); }
});

// Unsubscribe by token (from email link)
router.get('/unsubscribe/:token', async (req, res, next) => {
  try {
    const sub = await Newsletter.findOneAndUpdate(
      { token: req.params.token },
      { isActive: false },
      { new: true }
    );
    if (!sub) throw new AppError('Invalid unsubscribe token', 404, 'NOT_FOUND');
    res.json({ message: 'Unsubscribed successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
