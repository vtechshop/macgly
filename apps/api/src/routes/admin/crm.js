const router = require('express').Router();
const User = require('../../models/User');
const Order = require('../../models/Order');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = { role: 'customer' };
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [customers, total] = await Promise.all([
      User.find(filter).select('name email phone avatar createdAt lastLogin isActive').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    // Enrich with order stats
    const ids = customers.map((c) => c._id);
    const orderStats = await Order.aggregate([
      { $match: { user: { $in: ids } } },
      { $group: { _id: '$user', totalOrders: { $sum: 1 }, totalSpend: { $sum: '$totalAmount' }, lastOrderAt: { $max: '$createdAt' } } },
    ]);
    const statsMap = {};
    orderStats.forEach((s) => { statsMap[s._id.toString()] = s; });

    const enriched = customers.map((c) => {
      const st = statsMap[c._id.toString()] || {};
      return { ...c.toObject(), totalOrders: st.totalOrders || 0, totalSpend: st.totalSpend || 0, lastOrderAt: st.lastOrderAt || null };
    });

    res.json({ customers: enriched, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await User.findById(req.params.id).select('-password -refreshTokens');
    if (!customer) return res.status(404).json({ error: { message: 'Customer not found' } });
    const orders = await Order.find({ user: customer._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ customer, orders });
  } catch (err) { next(err); }
});

module.exports = router;
