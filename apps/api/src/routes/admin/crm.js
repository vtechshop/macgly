const router = require('express').Router();
const User = require('../../models/User');
const Order = require('../../models/Order');

function calculateSegment(orderCount, totalSpent, lastOrderDate, createdAt) {
  const now = Date.now();
  const daysSinceLast = lastOrderDate ? (now - new Date(lastOrderDate)) / 86400000 : Infinity;
  const daysSinceJoined = (now - new Date(createdAt)) / 86400000;

  if (totalSpent > 50000 || orderCount > 20) return 'vip';
  if (orderCount > 5 && daysSinceLast < 60) return 'loyal';
  if (daysSinceJoined < 30) return 'new';
  if (daysSinceLast >= 60 && daysSinceLast < 120) return 'at-risk';
  if (!lastOrderDate || daysSinceLast >= 120) return 'inactive';
  return 'regular';
}

// GET /admin/crm/stats
router.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);

    const [allCustomers, orderStats, activeUserIds, newThisMonth] = await Promise.all([
      User.find({ role: 'customer' }).select('_id createdAt').lean(),
      Order.aggregate([
        { $match: { user: { $ne: null }, paymentStatus: 'paid' } },
        { $group: { _id: '$user', orderCount: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' }, lastOrderDate: { $max: '$createdAt' } } },
      ]),
      Order.distinct('user', { user: { $ne: null }, paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ role: 'customer', createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    const statsMap = {};
    let totalRevenue = 0;
    let totalOrderCount = 0;
    orderStats.forEach((s) => {
      statsMap[s._id.toString()] = s;
      totalRevenue += s.totalSpent;
      totalOrderCount += s.orderCount;
    });

    const counts = { vip: 0, loyal: 0, new: 0, 'at-risk': 0, inactive: 0 };
    allCustomers.forEach((c) => {
      const st = statsMap[c._id.toString()] || {};
      const seg = calculateSegment(st.orderCount || 0, st.totalSpent || 0, st.lastOrderDate, c.createdAt);
      if (counts[seg] !== undefined) counts[seg]++;
    });

    res.json({
      totalCustomers: allCustomers.length,
      totalRevenue,
      avgOrderValue: totalOrderCount > 0 ? Math.round(totalRevenue / totalOrderCount) : 0,
      activeThisMonth: activeUserIds.length,
      newThisMonth,
      vipCount: counts.vip,
      loyalCount: counts.loyal,
      newCount: counts.new,
      atRiskCount: counts['at-risk'],
      inactiveCount: counts.inactive,
    });
  } catch (err) { next(err); }
});

// GET /admin/crm/customers
router.get('/customers', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, segment } = req.query;
    const filter = { role: 'customer' };
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];

    const customers = await User.find(filter)
      .select('name email phone addresses createdAt lastLogin isActive')
      .sort({ createdAt: -1 })
      .lean();

    const ids = customers.map((c) => c._id);
    const orderStats = await Order.aggregate([
      { $match: { user: { $in: ids }, paymentStatus: 'paid' } },
      { $group: { _id: '$user', orderCount: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' }, lastOrderDate: { $max: '$createdAt' } } },
    ]);
    const statsMap = {};
    orderStats.forEach((s) => { statsMap[s._id.toString()] = s; });

    let enriched = customers.map((c) => {
      const st = statsMap[c._id.toString()] || {};
      const orderCount = st.orderCount || 0;
      const totalSpent = st.totalSpent || 0;
      const lastOrderDate = st.lastOrderDate || null;
      const addr = c.addresses?.[0];
      return {
        _id: c._id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        location: addr ? [addr.city, addr.state].filter(Boolean).join(', ') : null,
        segment: calculateSegment(orderCount, totalSpent, lastOrderDate, c.createdAt),
        orderCount,
        totalSpent,
        avgOrderValue: orderCount > 0 ? Math.round(totalSpent / orderCount) : 0,
        lastOrderDate,
        createdAt: c.createdAt,
        lastLogin: c.lastLogin,
        isActive: c.isActive,
      };
    });

    if (segment) enriched = enriched.filter((c) => c.segment === segment);

    const total = enriched.length;
    const p = parseInt(page);
    const l = parseInt(limit);
    const paginated = enriched.slice((p - 1) * l, p * l);

    res.json({ customers: paginated, pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) } });
  } catch (err) { next(err); }
});

// GET /admin/crm/customers/:id/orders
router.get('/customers/:id/orders', async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.params.id })
      .select('orderId totalAmount status paymentStatus createdAt items')
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      orders: orders.map((o) => ({
        _id: o._id,
        orderNumber: o.orderId,
        total: o.totalAmount,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        itemCount: o.items?.length || 0,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
