const router = require('express').Router();
const Loyalty = require('../models/Loyalty');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Get my loyalty account
router.get('/', async (req, res, next) => {
  try {
    let loyalty = await Loyalty.findOne({ user: req.user._id });
    if (!loyalty) loyalty = await Loyalty.create({ user: req.user._id });
    res.json({ balance: loyalty.balance, totalEarned: loyalty.totalEarned, totalRedeemed: loyalty.totalRedeemed });
  } catch (err) { next(err); }
});

// Get transaction history
router.get('/transactions', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const loyalty = await Loyalty.findOne({ user: req.user._id });
    if (!loyalty) return res.json({ transactions: [], balance: 0 });
    const all = [...loyalty.transactions].reverse();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const slice = all.slice(skip, skip + parseInt(limit));
    res.json({ transactions: slice, total: all.length, balance: loyalty.balance });
  } catch (err) { next(err); }
});

// Redeem points (called from checkout)
router.post('/redeem', async (req, res, next) => {
  try {
    const { points } = req.body;
    if (!points || points < 1) throw new AppError('Invalid points value', 400, 'INVALID_POINTS');
    let loyalty = await Loyalty.findOne({ user: req.user._id });
    if (!loyalty) throw new AppError('No loyalty account found', 404, 'NOT_FOUND');
    loyalty.redeem(parseInt(points), 'Redeemed at checkout');
    await loyalty.save();
    res.json({ balance: loyalty.balance, redeemed: parseInt(points) });
  } catch (err) { next(err); }
});

module.exports = router;
