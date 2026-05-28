const router     = require('express').Router();
const Commission = require('../../models/Commission');
const User       = require('../../models/User');
const AppError   = require('../../utils/AppError');

// ── helpers ───────────────────────────────────────────────────────────────────

function dateFilter(days) {
  if (!days || days === 'all') return {};
  const d = parseInt(days);
  if (isNaN(d)) return {};
  return { createdAt: { $gte: new Date(Date.now() - d * 24 * 60 * 60 * 1000) } };
}

// ── GET /admin/commissions/stats — MUST be before / and /:id ─────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const { type = 'vendor', days } = req.query;
    const base = { type, ...dateFilter(days) };

    const [totalStats, pendingStats, approvedStats, paidStats, topVendors] = await Promise.all([
      Commission.aggregate([
        { $match: base },
        { $group: { _id: null, amount: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
      ]),
      Commission.aggregate([
        { $match: { ...base, status: 'pending' } },
        { $group: { _id: null, amount: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
      ]),
      Commission.aggregate([
        { $match: { ...base, status: 'approved' } },
        { $group: { _id: null, amount: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
      ]),
      Commission.aggregate([
        { $match: { ...base, status: 'paid' } },
        { $group: { _id: null, amount: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
      ]),
      Commission.aggregate([
        { $match: { type, status: { $in: ['pending', 'approved', 'paid'] } } },
        { $group: { _id: '$user', totalAmount: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: {
          totalAmount: 1, count: 1,
          storeName: { $ifNull: ['$u.vendorProfile.businessName', '$u.name'] },
        }},
      ]),
    ]);

    const get = (arr) => arr[0] || { amount: 0, count: 0 };

    res.json({
      totalAmount:    get(totalStats).amount,
      totalCount:     get(totalStats).count,
      pendingAmount:  get(pendingStats).amount,
      pendingCount:   get(pendingStats).count,
      approvedAmount: get(approvedStats).amount,
      approvedCount:  get(approvedStats).count,
      paidAmount:     get(paidStats).amount,
      paidCount:      get(paidStats).count,
      topVendors,
    });
  } catch (err) { next(err); }
});

// ── GET /admin/commissions/export — CSV download ──────────────────────────────
router.get('/export', async (req, res, next) => {
  try {
    const { type = 'vendor', status, days } = req.query;
    const filter = { type, ...dateFilter(days) };
    if (status && status !== 'all') filter.status = status;

    const commissions = await Commission.find(filter)
      .populate('user',    'name email vendorProfile')
      .populate('order',   'orderId totalAmount')
      .populate('product', 'title')
      .sort({ createdAt: -1 })
      .lean();

    const headers = ['Vendor','Vendor Email','Order ID','Date','Order Total','Commission %','Commission Amount','Status','Paid Date','Payment Ref'];
    const rows = commissions.map((c) => [
      c.user?.vendorProfile?.businessName || c.user?.name || '',
      c.user?.email || '',
      c.order?.orderId || '',
      c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '',
      c.saleAmount || 0,
      c.commissionRate || 0,
      c.commissionAmount || 0,
      c.status || '',
      c.paidAt ? new Date(c.paidAt).toLocaleDateString('en-IN') : '',
      c.paymentRef || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    // Summary
    const totalCommission = commissions.reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const pending  = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const approved = commissions.filter((c) => c.status === 'approved').reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const paid     = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const summary  = ['','','Summary','','','','','','',''].join(',') + '\n'
      + `"Total Records","${commissions.length}"\n`
      + `"Total Commission","${totalCommission}"\n`
      + `"Pending","${pending}"\n`
      + `"Approved","${approved}"\n`
      + `"Paid","${paid}"`;

    const csv = [headers.join(','), ...rows, '', summary].join('\n');
    const filename = `commissions_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) { next(err); }
});

// ── POST /admin/commissions/bulk-approve — MUST be before /:id ────────────────
router.post('/bulk-approve', async (req, res, next) => {
  try {
    const { commissionIds, type = 'vendor', days } = req.body;

    let filter = { status: 'pending' };
    if (commissionIds?.length) {
      filter._id = { $in: commissionIds };
    } else {
      filter.type = type;
      Object.assign(filter, dateFilter(days));
    }

    const result = await Commission.updateMany(filter, {
      status: 'approved', approvedAt: new Date(),
    });

    res.json({ ok: true, count: result.modifiedCount, message: `${result.modifiedCount} commission(s) approved` });
  } catch (err) { next(err); }
});

// ── GET /admin/commissions ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { type = 'vendor', status, days, page = 1, limit = 20 } = req.query;
    const filter = { type, ...dateFilter(days) };
    if (status && status !== 'all') filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [commissions, total] = await Promise.all([
      Commission.find(filter)
        .populate('user',    'name email vendorProfile')
        .populate('order',   'orderId totalAmount')
        .populate('product', 'title images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Commission.countDocuments(filter),
    ]);

    res.json({
      commissions,
      pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// ── PUT /admin/commissions/:id/approve ────────────────────────────────────────
router.put('/:id/approve', async (req, res, next) => {
  try {
    const commission = await Commission.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status: 'approved', approvedAt: new Date() },
      { new: true },
    );
    if (!commission) throw new AppError('Commission not found or already processed', 404, 'NOT_FOUND');
    res.json({ commission });
  } catch (err) { next(err); }
});

// ── PUT /admin/commissions/:id/reject ─────────────────────────────────────────
router.put('/:id/reject', async (req, res, next) => {
  try {
    const commission = await Commission.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status: 'cancelled', rejectedAt: new Date() },
      { new: true },
    );
    if (!commission) throw new AppError('Commission not found or already processed', 404, 'NOT_FOUND');
    res.json({ commission });
  } catch (err) { next(err); }
});

// ── PATCH /:id/approve — backward compat ──────────────────────────────────────
router.patch('/:id/approve', async (req, res, next) => {
  try {
    const commission = await Commission.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvedAt: new Date() },
      { new: true },
    );
    if (!commission) throw new AppError('Commission not found', 404, 'NOT_FOUND');
    res.json({ commission });
  } catch (err) { next(err); }
});

// ── PATCH /:id/paid — backward compat ─────────────────────────────────────────
router.patch('/:id/paid', async (req, res, next) => {
  try {
    const { payoutId } = req.body;
    const commission = await Commission.findByIdAndUpdate(
      req.params.id,
      { status: 'paid', paidAt: new Date(), payoutId },
      { new: true },
    );
    if (!commission) throw new AppError('Commission not found', 404, 'NOT_FOUND');
    if (commission.type === 'vendor') {
      User.findByIdAndUpdate(commission.user, { $inc: { 'vendorProfile.totalEarnings': commission.commissionAmount } }).catch(() => {});
    } else if (commission.type === 'affiliate') {
      User.findByIdAndUpdate(commission.user, { $inc: { 'affiliateProfile.totalEarnings': commission.commissionAmount } }).catch(() => {});
    }
    res.json({ commission });
  } catch (err) { next(err); }
});

module.exports = router;
