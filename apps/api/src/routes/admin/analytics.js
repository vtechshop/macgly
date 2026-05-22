const router = require('express').Router();
const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Category = require('../../models/Category');

router.get('/', async (req, res, next) => {
  try {
    const { days: daysParam = 30 } = req.query;
    const numDays = Math.min(parseInt(daysParam) || 30, 90);
    const since = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000);
    const revenueFilter = { $or: [{ paymentStatus: 'paid' }, { status: 'delivered' }] };

    const [revenueByDay, ordersByStatus, topProducts, topVendors, topCategories, newUsersByDay] = await Promise.all([
      // Daily revenue for the selected period
      Order.aggregate([
        { $match: { ...revenueFilter, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // Order breakdown by status
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Top 10 products by revenue in period
      Order.aggregate([
        { $match: { ...revenueFilter, createdAt: { $gte: since } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', title: { $first: '$items.title' }, totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),

      // Top 10 vendors by revenue in period
      Order.aggregate([
        { $match: { ...revenueFilter, createdAt: { $gte: since } } },
        { $unwind: '$items' },
        { $match: { 'items.vendorId': { $exists: true, $ne: null } } },
        { $group: { _id: '$items.vendorId', totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, totalOrders: { $sum: 1 } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'vendor' } },
        { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
        { $project: { totalRevenue: 1, totalOrders: 1, name: { $ifNull: ['$vendor.vendorProfile.businessName', '$vendor.name'] } } },
      ]),

      // Top categories by order items
      Order.aggregate([
        { $match: { ...revenueFilter, createdAt: { $gte: since } } },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $match: { 'prod.category': { $exists: true, $ne: '' } } },
        { $group: { _id: '$prod.category', totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, totalQty: { $sum: '$items.quantity' } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),

      // New users per day for the period
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Fill all days
    const allDays = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const rev = revenueByDay.find((r) => r._id === key);
      const usr = newUsersByDay.find((u) => u._id === key);
      allDays.push({ date: key, revenue: rev?.revenue || 0, orders: rev?.orders || 0, newUsers: usr?.count || 0 });
    }

    const statusMap = {};
    ordersByStatus.forEach((s) => { statusMap[s._id] = s.count; });

    res.json({
      period: numDays,
      revenueByDay: allDays,
      ordersByStatus: statusMap,
      topProducts,
      topVendors,
      topCategories,
    });
  } catch (err) { next(err); }
});

module.exports = router;
