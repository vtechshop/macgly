const router = require('express').Router();
const Order = require('../../models/Order');
const Product = require('../../models/Product');

function warrantyExpiryMs(deliveredAt, duration, durationType) {
  const d = new Date(deliveredAt);
  if (durationType === 'days')   d.setDate(d.getDate() + duration);
  if (durationType === 'months') d.setMonth(d.getMonth() + duration);
  if (durationType === 'years')  d.setFullYear(d.getFullYear() + duration);
  return d;
}

function warrantyStatus(expiryDate) {
  const now = Date.now();
  const exp = new Date(expiryDate).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (exp < now) return 'expired';
  if (exp - now <= thirtyDays) return 'expiring_soon';
  return 'active';
}

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get all products that have warranty info
    const products = await Product.find({
      'warranty.duration': { $exists: true, $gt: 0 },
    }).select('title sku images warranty price');

    // Get delivered orders for those products
    const productIds = products.map((p) => p._id);
    const orders = await Order.find({
      status: 'delivered',
      'items.product': { $in: productIds },
    })
      .populate('user', 'name email phone')
      .populate('items.product', 'title sku images warranty')
      .select('orderId user items deliveredAt updatedAt createdAt shippingAddress');

    // Build flat warranty records per order item
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const records = [];

    for (const order of orders) {
      const deliveryDate = order.deliveredAt || order.updatedAt;
      for (const item of order.items) {
        const prod = item.product;
        if (!prod?.warranty?.duration) continue;

        const expiry = warrantyExpiryMs(deliveryDate, prod.warranty.duration, prod.warranty.durationType || 'months');
        const ws = warrantyStatus(expiry);
        const daysLeft = Math.ceil((expiry.getTime() - now) / 86400000);

        records.push({
          _id: `${order._id}-${item._id}`,
          orderId: order.orderId,
          orderedAt: order.createdAt,
          deliveredAt: deliveryDate,
          expiresAt: expiry,
          daysLeft,
          status: ws,
          customer: order.user,
          shippingAddress: order.shippingAddress,
          product: {
            _id: prod._id,
            title: prod.title || item.title,
            sku: prod.sku || item.sku,
            image: prod.images?.[0] || item.image,
            warranty: prod.warranty,
          },
          quantity: item.quantity,
        });
      }
    }

    // Summary per warranty type
    const typeMap = {};
    for (const r of records) {
      const type = r.product.warranty.description || 'Manufacturer Warranty';
      if (!typeMap[type]) typeMap[type] = { type, total: 0, active: 0, expiring: 0, expired: 0, avgDays: 0, _days: [] };
      typeMap[type].total++;
      if (r.status === 'active') typeMap[type].active++;
      if (r.status === 'expiring_soon') typeMap[type].expiring++;
      if (r.status === 'expired') typeMap[type].expired++;
      const w = r.product.warranty;
      const d = w.durationType === 'years' ? w.duration * 365 : w.durationType === 'months' ? w.duration * 30 : w.duration;
      typeMap[type]._days.push(d);
    }
    const warrantyTypes = Object.values(typeMap).map((t) => ({
      ...t,
      avgDays: t._days.length ? Math.round(t._days.reduce((a, b) => a + b, 0) / t._days.length) : 0,
      _days: undefined,
    }));

    const total = records.length;
    const active = records.filter((r) => r.status === 'active').length;
    const expiringSoon = records.filter((r) => r.status === 'expiring_soon').length;
    const expired = records.filter((r) => r.status === 'expired').length;
    const allDays = records.map((r) => {
      const w = r.product.warranty;
      return w.durationType === 'years' ? w.duration * 365 : w.durationType === 'months' ? w.duration * 30 : w.duration;
    });
    const avgPeriod = allDays.length ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : 0;

    // Filter + search
    let filtered = records;
    if (status) filtered = filtered.filter((r) => r.status === status);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) =>
        r.product.title?.toLowerCase().includes(q) ||
        r.customer?.name?.toLowerCase().includes(q) ||
        r.customer?.email?.toLowerCase().includes(q) ||
        r.orderId?.toLowerCase().includes(q)
      );
    }

    const paginated = filtered.slice(skip, skip + parseInt(limit));

    res.json({
      warranties: paginated,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: filtered.length },
      stats: { total, active, expiringSoon, expired, pendingClaims: 0, avgPeriod },
      warrantyTypes,
    });
  } catch (err) { next(err); }
});

module.exports = router;
