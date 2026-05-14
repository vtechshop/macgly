const router = require('express').Router();
const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const revenueFilter = { $or: [{ paymentStatus: 'paid' }, { status: 'delivered' }] };
    const activeStatuses = ['pending', 'confirmed', 'processing', 'shipped'];

    const [
      products, orders, customers, vendorCount, affiliateCount, pendingVendors,
      revenueAll, revenueMonth, revenueWeek, revenueToday,
      recentOrders, lowStock,
      ordersThisWeek, newUsersThisWeek,
      orderStatusCounts, revenueByDay, topProducts,
      adminCommission,
      vendorCommissionPaid, vendorCommissionPending,
      affiliateCommissionPaid, affiliateCommissionPending,
      pendingActions,
      revenueLastWeek, ordersLastWeek, revenueLastMonth,
      pendingTickets,
    ] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'vendor' }),
      User.countDocuments({ role: 'affiliate' }),
      User.countDocuments({ role: 'vendor', 'vendorProfile.approved': false }),
      Order.aggregate([{ $match: revenueFilter }, { $group: { _id: null, t: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: { ...revenueFilter, createdAt: { $gte: thirtyDaysAgo } } }, { $group: { _id: null, t: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: { ...revenueFilter, createdAt: { $gte: sevenDaysAgo } } }, { $group: { _id: null, t: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: { ...revenueFilter, createdAt: { $gte: todayStart } } }, { $group: { _id: null, t: { $sum: '$totalAmount' } } }]),
      Order.find().sort({ createdAt: -1 }).limit(8).populate('user', 'name email'),
      Product.find({ stock: { $lte: 10 }, published: true }).select('title sku stock images').sort({ stock: 1 }).limit(8),
      Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { ...revenueFilter, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.product', title: { $first: '$items.title' }, totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]),
      // Admin commission = sum of platform fees from settled orders
      Order.aggregate([{ $match: revenueFilter }, { $group: { _id: null, t: { $sum: '$totalPlatformFee' } } }]),
      // Vendor commissions — paid (settled) and pending (active orders)
      Order.aggregate([
        { $match: revenueFilter },
        { $unwind: '$items' },
        { $group: { _id: null, t: { $sum: '$items.vendorEarning' } } },
      ]),
      Order.aggregate([
        { $match: { status: { $in: activeStatuses } } },
        { $unwind: '$items' },
        { $group: { _id: null, t: { $sum: '$items.vendorEarning' } } },
      ]),
      // Affiliate commissions — paid and pending
      Order.aggregate([
        { $match: { affiliateId: { $exists: true, $ne: null }, status: 'delivered' } },
        { $group: { _id: null, t: { $sum: '$affiliateCommission' } } },
      ]),
      Order.aggregate([
        { $match: { affiliateId: { $exists: true, $ne: null }, status: { $in: activeStatuses } } },
        { $group: { _id: null, t: { $sum: '$affiliateCommission' } } },
      ]),
      // Pending actions = orders needing attention
      Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'processing'] } }),
      // Last week revenue + orders (for trend %)
      Order.aggregate([{ $match: { ...revenueFilter, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } }, { $group: { _id: null, t: { $sum: '$totalAmount' } } }]),
      Order.countDocuments({ createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } }),
      // Last month revenue (30-60 days ago)
      Order.aggregate([{ $match: { ...revenueFilter, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } }, { $group: { _id: null, t: { $sum: '$totalAmount' } } }]),
      // Pending support tickets
      (async () => { try { const Ticket = require('../../models/Ticket'); return Ticket.countDocuments({ status: 'open' }); } catch { return 0; } })(),
    ]);

    // Fill last 7 days with 0s for missing dates
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const match = revenueByDay.find((r) => r._id === key);
      days.push({ date: key, revenue: match?.revenue || 0, orders: match?.orders || 0 });
    }

    const statusMap = {};
    orderStatusCounts.forEach((s) => { statusMap[s._id] = s.count; });

    res.json({
      stats: {
        products, orders, customers, vendorCount, affiliateCount, pendingVendors,
        revenue: revenueAll[0]?.t || 0,
        revenueMonth: revenueMonth[0]?.t || 0,
        revenueWeek: revenueWeek[0]?.t || 0,
        revenueToday: revenueToday[0]?.t || 0,
        ordersThisWeek, newUsersThisWeek,
        orderStatus: statusMap,
        adminCommission: adminCommission[0]?.t || 0,
        vendorCommissionPaid: vendorCommissionPaid[0]?.t || 0,
        vendorCommissionPending: vendorCommissionPending[0]?.t || 0,
        affiliateCommissionPaid: affiliateCommissionPaid[0]?.t || 0,
        affiliateCommissionPending: affiliateCommissionPending[0]?.t || 0,
        pendingActions,
        revenueLastWeek: revenueLastWeek[0]?.t || 0,
        ordersLastWeek,
        revenueLastMonth: revenueLastMonth[0]?.t || 0,
        pendingTickets,
        avgOrderValue: orders > 0 ? Math.round((revenueAll[0]?.t || 0) / orders) : 0,
      },
      recentOrders,
      lowStock,
      revenueByDay: days,
      topProducts,
    });
  } catch (err) { next(err); }
});

module.exports = router;
