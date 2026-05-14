const router = require('express').Router();
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

const history = []; // in-memory log (replace with DB model if needed)

router.post('/send', async (req, res, next) => {
  try {
    const { to, subject, message } = req.body;
    if (!subject || !message) throw new AppError('Subject and message required', 400, 'MISSING_FIELDS');

    const roleMap = { all: undefined, customers: 'customer', vendors: 'vendor', affiliates: 'affiliate' };
    const role = roleMap[to];
    const filter = {};
    if (role) filter.role = role;
    filter.isActive = true;

    const users = await User.find(filter).select('name email');

    const { sendEmail } = require('../../services/emailService');
    let sent = 0;
    for (const user of users) {
      try {
        await sendEmail({ to: user.email, subject, html: `<p>Hi ${user.name},</p><p>${message.replace(/\n/g, '<br>')}</p>` });
        sent++;
      } catch { /* skip individual failures */ }
    }

    history.unshift({ to, subject, message, sent, total: users.length, sentAt: new Date(), sentBy: req.user._id });
    if (history.length > 50) history.length = 50;

    res.json({ sent, total: users.length });
  } catch (err) { next(err); }
});

router.get('/history', (req, res) => {
  res.json({ history });
});

module.exports = router;
