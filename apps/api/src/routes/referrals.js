const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const Referral = require('../models/Referral');
const User = require('../models/User');
const AppError = require('../utils/AppError');

router.use(authenticate);

// Get my referral code and stats
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('referralCode name');

    const [referrals, stats] = await Promise.all([
      Referral.find({ referrer: req.user._id }).populate('referee', 'name createdAt').sort({ createdAt: -1 }).limit(20),
      Referral.aggregate([
        { $match: { referrer: req.user._id } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$commissionAmount' } } },
      ]),
    ]);

    const summary = { total: 0, pending: 0, credited: 0, totalEarned: 0 };
    stats.forEach((s) => {
      summary.total += s.count;
      summary[s._id] = s.count;
      if (s._id === 'credited') summary.totalEarned = s.total;
    });

    res.json({ referralCode: user.referralCode, summary, referrals });
  } catch (err) { next(err); }
});

// Apply a referral code (called post-registration or at checkout)
router.post('/apply', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return next(new AppError('Referral code required', 400));

    const referrer = await User.findOne({ referralCode: code.toUpperCase() });
    if (!referrer) return next(new AppError('Invalid referral code', 404));
    if (referrer._id.toString() === req.user._id.toString()) {
      return next(new AppError('Cannot use your own referral code', 400));
    }

    // Store referrer on session/user for checkout attribution
    await User.findByIdAndUpdate(req.user._id, { referredBy: referrer._id });
    res.json({ message: 'Referral code applied', referrerName: referrer.name });
  } catch (err) { next(err); }
});

module.exports = router;
