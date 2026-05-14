const router = require('express').Router();
const Commission = require('../../models/Commission');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

// GET /admin/commissions?type=vendor|affiliate&status=pending&page=1
router.get('/', async (req, res, next) => {
  try {
    const { type, status, userId, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (userId) filter.user = userId;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [commissions, total] = await Promise.all([
      Commission.find(filter)
        .populate('user', 'name email')
        .populate('order', 'orderId totalAmount')
        .populate('product', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Commission.countDocuments(filter),
    ]);
    // Summary stats
    const [pending, approved] = await Promise.all([
      Commission.aggregate([
        { $match: { ...filter, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
      ]),
      Commission.aggregate([
        { $match: { ...filter, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
      ]),
    ]);
    res.json({
      commissions,
      pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) },
      summary: {
        pendingAmount: pending[0]?.total || 0,
        approvedAmount: approved[0]?.total || 0,
      },
    });
  } catch (err) { next(err); }
});

// Approve single commission
router.patch('/:id/approve', async (req, res, next) => {
  try {
    const commission = await Commission.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    );
    if (!commission) throw new AppError('Commission not found', 404, 'NOT_FOUND');
    res.json({ commission });
  } catch (err) { next(err); }
});

// Bulk approve
router.post('/bulk-approve', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) throw new AppError('ids array required', 400, 'MISSING_FIELDS');
    await Commission.updateMany({ _id: { $in: ids }, status: 'pending' }, { status: 'approved' });
    res.json({ ok: true, updated: ids.length });
  } catch (err) { next(err); }
});

// Mark paid (after payout)
router.patch('/:id/paid', async (req, res, next) => {
  try {
    const { payoutId } = req.body;
    const commission = await Commission.findByIdAndUpdate(
      req.params.id,
      { status: 'paid', paidAt: new Date(), payoutId },
      { new: true }
    );
    if (!commission) throw new AppError('Commission not found', 404, 'NOT_FOUND');
    // Update vendor totalEarnings
    if (commission.type === 'vendor') {
      await User.findByIdAndUpdate(commission.user, { $inc: { 'vendorProfile.totalEarnings': commission.commissionAmount } });
    } else if (commission.type === 'affiliate') {
      await User.findByIdAndUpdate(commission.user, { $inc: { 'affiliateProfile.totalEarnings': commission.commissionAmount } });
    }
    res.json({ commission });
  } catch (err) { next(err); }
});

module.exports = router;
