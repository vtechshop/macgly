const router = require('express').Router();
const Order  = require('../../models/Order');

function since(days) {
  if (!days || days === 'all') return new Date(0);
  if (days === 'year') return new Date(new Date().getFullYear(), 0, 1);
  if (days === '1') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }
  return new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
}

function categorize(paymentStatus) {
  if (['paid', 'captured', 'completed'].includes(paymentStatus)) return 'successful';
  if (paymentStatus === 'failed')   return 'failed';
  if (paymentStatus === 'refunded') return 'refunded';
  return 'pending';
}

// ── GET /admin/payments/stats — MUST be before / ──────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const orders = await Order.find({ createdAt: { $gte: since(req.query.days) } })
      .select('paymentStatus paymentMethod totalAmount createdAt')
      .lean();

    let successfulCount = 0, successfulAmount = 0;
    let pendingCount    = 0, pendingAmount    = 0;
    let failedCount     = 0, failedAmount     = 0;
    let refundedCount   = 0, refundedAmount   = 0;
    const methodMap = {};

    for (const o of orders) {
      const amt = o.totalAmount || 0;
      const cat = categorize(o.paymentStatus);
      const m   = o.paymentMethod || 'other';

      if      (cat === 'successful') { successfulCount++; successfulAmount += amt; }
      else if (cat === 'pending')    { pendingCount++;    pendingAmount    += amt; }
      else if (cat === 'failed')     { failedCount++;     failedAmount     += amt; }
      else if (cat === 'refunded')   { refundedCount++;   refundedAmount   += amt; }

      if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
      methodMap[m].count++;
      methodMap[m].total += amt;
    }

    const totalRevenue     = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const availableBalance = successfulAmount - refundedAmount;
    const reservedAmount   = parseFloat((successfulAmount * 0.02).toFixed(2));
    const nextPayoutAmount = parseFloat((availableBalance - reservedAmount).toFixed(2));

    res.json({
      totalRevenue,
      totalTransactions:  orders.length,
      successfulPayments: successfulCount,
      successfulAmount,
      pendingPayments:    pendingCount,
      pendingAmount,
      failedPayments:     failedCount,
      failedAmount,
      refundedPayments:   refundedCount,
      refundedAmount,
      paymentMethods:     Object.entries(methodMap).map(([_id, v]) => ({ _id, count: v.count, total: v.total })),
      availableBalance,
      reservedAmount,
      nextPayoutAmount,
      nextPayoutDate: 'Weekly settlement',
    });
  } catch (err) { next(err); }
});

// ── GET /admin/payments — paginated transaction list ──────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, paymentMethod, status, search, days } = req.query;
    const filter = { createdAt: { $gte: since(days) } };

    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (status === 'successful') {
      filter.paymentStatus = { $in: ['paid', 'captured', 'completed'] };
    } else if (status && status !== 'all') {
      filter.paymentStatus = status;
    }

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ orderId: re }, { customerName: re }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email')
        .select('orderId user customerName totalAmount totalPlatformFee paymentMethod paymentStatus razorpayPaymentId createdAt')
        .lean(),
      Order.countDocuments(filter),
    ]);

    const data = orders.map((o) => ({
      _id:              o._id,
      orderId:          o.orderId,
      customerName:     o.user?.name   || o.customerName || 'Guest',
      customerEmail:    o.user?.email  || '',
      paymentMethod:    o.paymentMethod,
      amount:           o.totalAmount  || 0,
      platformFee:      o.totalPlatformFee || 0,
      status:           o.paymentStatus || 'pending',
      razorpayPaymentId: o.razorpayPaymentId || '',
      createdAt:        o.createdAt,
    }));

    res.json({
      data,
      meta: {
        total, page: parseInt(page), limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
