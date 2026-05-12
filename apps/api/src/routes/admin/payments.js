const router = require('express').Router();
const Order = require('../../models/Order');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, method, status } = req.query;
    // Only show real payment transactions — exclude pending COD orders waiting for delivery
    const baseFilter = { paymentStatus: { $in: ['paid', 'failed', 'refunded'] } };
    const filter = { ...baseFilter };
    if (method) filter.paymentMethod = method;
    if (status && ['paid', 'failed', 'refunded'].includes(status)) filter.paymentStatus = status;
    else if (!status) filter.paymentStatus = { $in: ['paid', 'failed', 'refunded'] };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total, summary, methodBreakdown] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email')
        .select('orderId user totalAmount paymentMethod paymentStatus razorpayPaymentId createdAt status'),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: { paymentStatus: { $in: ['paid', 'failed', 'refunded'] } } },
        {
          $facet: {
            total: [{ $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } }],
            paid: [{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } }],
            failed: [{ $match: { paymentStatus: 'failed' } }, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } }],
            refunded: [{ $match: { paymentStatus: 'refunded' } }, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } }],
          },
        },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: { $in: ['paid', 'failed', 'refunded'] } } },
        { $group: { _id: '$paymentMethod', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const s = summary[0] || {};
    const get = (arr) => arr?.[0] || { revenue: 0, count: 0 };

    const totalRevenue = get(s.total).revenue;
    const paidRevenue = get(s.paid).revenue;

    res.json({
      orders,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
      summary: {
        totalRevenue,
        totalOrders: get(s.total).count,
        paid: { count: get(s.paid).count, revenue: paidRevenue },
        failed: { count: get(s.failed).count, revenue: get(s.failed).revenue },
        refunded: { count: get(s.refunded).count, revenue: get(s.refunded).revenue },
        availableBalance: paidRevenue,
        nextPayout: paidRevenue,
      },
      methodBreakdown,
    });
  } catch (err) { next(err); }
});

module.exports = router;
