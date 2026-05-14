const router = require('express').Router();
const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const AppError = require('../../utils/AppError');

// Individual order detail
router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    if (!order) return next(new AppError('Order not found', 404));
    res.json({ order });
  } catch (err) { next(err); }
});

// Quick status update
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!status) return next(new AppError('status is required', 400));
    const prev = await Order.findById(req.params.id);
    if (!prev) return next(new AppError('Order not found', 404));
    const update = { status };
    if (status === 'delivered' && prev.status !== 'delivered') {
      if (prev.paymentMethod === 'cod') update.paymentStatus = 'paid';
      update.deliveredAt = new Date();
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { ...update, $push: { 'tracking.history': { status, timestamp: new Date(), description: note || '' } } },
      { new: true }
    );
    res.json({ order });
  } catch (err) { next(err); }
});

// Update tracking info
router.patch('/:id/tracking', async (req, res, next) => {
  try {
    const { carrier, trackingId, url } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { 'tracking.carrier': carrier, 'tracking.trackingId': trackingId, 'tracking.url': url } },
      { new: true }
    );
    if (!order) return next(new AppError('Order not found', 404));
    res.json({ order });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
        .populate('user', 'name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'paymentStatus', 'tracking'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const prev = await Order.findById(req.params.id);
    if (!prev) throw new AppError('Order not found', 404, 'NOT_FOUND');

    // Auto-mark COD orders as paid when delivered; record delivery timestamp
    if (update.status === 'delivered' && prev.status !== 'delivered') {
      if (prev.paymentMethod === 'cod') update.paymentStatus = 'paid';
      update.deliveredAt = new Date();
    }

    // Append status change to tracking history
    const historyEntry = update.status && update.status !== prev.status
      ? { status: update.status, timestamp: new Date(), description: req.body.note || '' }
      : null;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        ...update,
        ...(historyEntry && { $push: { 'tracking.history': historyEntry } }),
      },
      { new: true }
    );

    if (update.status) {
      const wasDelivered = prev.status === 'delivered';
      const nowDelivered = order.status === 'delivered';
      const nowReversed = ['cancelled', 'returned'].includes(order.status);

      // Affiliate earnings
      if (order.affiliateId && order.affiliateCommission > 0) {
        if (!wasDelivered && nowDelivered) {
          await User.findByIdAndUpdate(order.affiliateId, { $inc: { 'affiliateProfile.totalEarnings': order.affiliateCommission } });
        } else if (wasDelivered && nowReversed) {
          await User.findByIdAndUpdate(order.affiliateId, { $inc: { 'affiliateProfile.totalEarnings': -order.affiliateCommission } });
        }
      }

      // Vendor earnings — credit each vendor their net earning on delivery, reverse on return
      const vendorItems = order.items.filter((i) => i.vendorId && i.vendorEarning > 0);
      if (vendorItems.length > 0) {
        if (!wasDelivered && nowDelivered) {
          await Promise.all(vendorItems.map((item) =>
            User.findByIdAndUpdate(item.vendorId, { $inc: { 'vendorProfile.totalEarnings': item.vendorEarning } })
          ));
        } else if (wasDelivered && nowReversed) {
          await Promise.all(vendorItems.map((item) =>
            User.findByIdAndUpdate(item.vendorId, { $inc: { 'vendorProfile.totalEarnings': -item.vendorEarning } })
          ));
        }
      }
    }

    res.json({ order });
  } catch (err) { next(err); }
});

// Manually attribute an order to an affiliate (by referral code)
router.put('/:id/affiliate', async (req, res, next) => {
  try {
    const { affiliateCode } = req.body;
    if (!affiliateCode) throw new AppError('affiliateCode required', 400, 'MISSING_FIELDS');

    const affiliate = await User.findOne({ 'affiliateProfile.referralCode': affiliateCode.toUpperCase().trim(), role: 'affiliate' });
    if (!affiliate) throw new AppError('Affiliate not found for that code', 404, 'NOT_FOUND');

    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    const rate = affiliate.affiliateProfile?.commissionRate ?? 5;
    const commission = parseFloat((order.totalAmount * rate / 100).toFixed(2));

    const wasAlreadyAttributed = !!order.affiliateId;
    const wasDelivered = order.status === 'delivered';

    // If previously attributed to someone else and was delivered, reverse old earnings
    if (wasAlreadyAttributed && wasDelivered && order.affiliateCommission > 0) {
      await User.findByIdAndUpdate(order.affiliateId, { $inc: { 'affiliateProfile.totalEarnings': -order.affiliateCommission } });
    }

    order.affiliateId = affiliate._id;
    order.affiliateCommission = commission;
    await order.save();

    // If already delivered, credit immediately
    if (wasDelivered) {
      await User.findByIdAndUpdate(affiliate._id, { $inc: { 'affiliateProfile.totalEarnings': commission } });
    }

    res.json({ order, affiliate: { name: affiliate.name, commission } });
  } catch (err) { next(err); }
});

// Stats endpoint
router.get('/stats', async (req, res, next) => {
  try {
    const [products, orders, users, revenueResult] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);
    res.json({ stats: { products, orders, users, revenue: revenueResult[0]?.total || 0 } });
  } catch (err) { next(err); }
});

module.exports = router;
