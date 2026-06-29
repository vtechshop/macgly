const router = require('express').Router();
const Order   = require('../../models/Order');
const User    = require('../../models/User');
const Product = require('../../models/Product');
const AppError = require('../../utils/AppError');
const { createShipment } = require('../../services/shippingService');
const notif      = require('../../utils/notificationHelper');
const whatsapp   = require('../../services/whatsappService');
const { sendShippingUpdate } = require('../../services/emailService');

// ── helpers ──────────────────────────────────────────────────────────────────

async function applyEarnings(order, newStatus) {
  const prev = order.status;
  const nowDelivered = newStatus === 'delivered';
  const wasDelivered = prev === 'delivered';
  const nowReversed  = ['cancelled', 'returned'].includes(newStatus);

  // Affiliate earnings
  if (order.affiliateId && order.affiliateCommission > 0) {
    if (!wasDelivered && nowDelivered) {
      await User.findByIdAndUpdate(order.affiliateId, {
        $inc: { 'affiliateProfile.totalEarnings': order.affiliateCommission },
      });
    } else if (wasDelivered && nowReversed) {
      await User.findByIdAndUpdate(order.affiliateId, {
        $inc: { 'affiliateProfile.totalEarnings': -order.affiliateCommission },
      });
    }
  }

  // Vendor earnings
  const vendorItems = (order.items || []).filter((i) => i.vendorId && i.vendorEarning > 0);
  if (vendorItems.length > 0) {
    if (!wasDelivered && nowDelivered) {
      await Promise.all(vendorItems.map((item) =>
        User.findByIdAndUpdate(item.vendorId, {
          $inc: { 'vendorProfile.totalEarnings': item.vendorEarning },
        }),
      ));
    } else if (wasDelivered && nowReversed) {
      await Promise.all(vendorItems.map((item) =>
        User.findByIdAndUpdate(item.vendorId, {
          $inc: { 'vendorProfile.totalEarnings': -item.vendorEarning },
        }),
      ));
    }
  }
}

// ── POST /admin/orders/bulk-status ───────────────────────────────────────────
// MUST be defined BEFORE /:id routes
router.post('/bulk-status', async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError('ids array is required', 400, 'MISSING_FIELDS');
    if (!status) throw new AppError('status is required', 400, 'MISSING_FIELDS');

    const orders = await Order.find({ _id: { $in: ids } });
    if (!orders.length) throw new AppError('No orders found', 404, 'NOT_FOUND');

    await Promise.all(orders.map(async (order) => {
      const update = { status };
      if (status === 'delivered' && order.status !== 'delivered') {
        if (order.paymentMethod === 'cod') update.paymentStatus = 'paid';
        update.deliveredAt = new Date();
      }
      await applyEarnings(order, status).catch(() => {});
      return Order.findByIdAndUpdate(
        order._id,
        {
          ...update,
          $push: { 'tracking.history': { status, timestamp: new Date(), description: 'Bulk status update' } },
        }
      );
    }));

    res.json({ updated: orders.length });
  } catch (err) { next(err); }
});

// ── GET /admin/orders/counts — tab badge numbers ──────────────────────────────
// MUST be defined BEFORE /:id to avoid 'counts' being treated as an ID.
router.get('/counts', async (req, res, next) => {
  try {
    const [groups, total] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.countDocuments(),
    ]);
    const result = { total };
    groups.forEach(({ _id, count }) => { if (_id) result[_id] = count; });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /admin/orders/stats ───────────────────────────────────────────────────
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

// ── GET /admin/orders — paginated list ────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, vendorId, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { orderId: re },
        { 'shippingAddress.name': re },
        { guestEmail: re },
      ];
    }
    if (vendorId) filter['items.vendorId'] = vendorId;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email phone')
        .lean(),
      Order.countDocuments(filter),
    ]);
    res.json({
      orders,
      pagination: {
        page: parseInt(page), limit: parseInt(limit), total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// ── GET /admin/orders/export — CSV download ───────────────────────────────────
// MUST be defined BEFORE /:id to avoid 'export' being treated as an ID
router.get('/export', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ orderId: re }, { 'shippingAddress.name': re }, { guestEmail: re }];
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone')
      .lean();

    const date = new Date().toISOString().split('T')[0];
    const header = 'Order ID,Date,Customer Name,Email,Phone,Status,Payment Method,Total,Items Count,City,State,Pincode\n';
    const rows = orders.map((o) => {
      const addr = o.shippingAddress || {};
      const customerName = o.user?.name || addr.name || 'Guest';
      const email = o.user?.email || o.guestEmail || '';
      const phone = o.user?.phone || addr.phone || '';
      return [
        o.orderId || '',
        new Date(o.createdAt).toISOString().split('T')[0],
        `"${customerName.replace(/"/g, '""')}"`,
        email,
        phone,
        o.status,
        o.paymentMethod || '',
        o.totalAmount,
        (o.items || []).length,
        `"${(addr.city || '').replace(/"/g, '""')}"`,
        `"${(addr.state || '').replace(/"/g, '""')}"`,
        addr.pincode || '',
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${date}.csv"`);
    res.send(header + rows);
  } catch (err) { next(err); }
});

// ── GET /admin/orders/:id — full detail ───────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .lean();
    if (!order) return next(new AppError('Order not found', 404));
    res.json({ order });
  } catch (err) { next(err); }
});

// ── PUT /admin/orders/:id/status ──────────────────────────────────────────────
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status, description } = req.body;
    if (!status) throw new AppError('status is required', 400, 'MISSING_STATUS');

    const prev = await Order.findById(req.params.id);
    if (!prev) throw new AppError('Order not found', 404, 'NOT_FOUND');

    const update = { status };
    if (status === 'delivered' && prev.status !== 'delivered') {
      if (prev.paymentMethod === 'cod') update.paymentStatus = 'paid';
      update.deliveredAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        ...update,
        $push: {
          'tracking.history': {
            status,
            timestamp: new Date(),
            description: description || '',
          },
        },
      },
      { new: true },
    ).populate('user', 'name email phone');

    // Apply affiliate / vendor earning logic
    await applyEarnings(prev, status).catch((e) =>
      console.error('[Orders] earnings error:', e.message),
    );

    // Notify customer of status change (in-app + WhatsApp + email)
    if (order.user) {
      const userObj = order.user;
      notif.notifyCustomerOrderStatus({ userId: userObj, order, status }).catch(() => {});
      if (status === 'shipped')   whatsapp.notifyOrderShipped(order, userObj).catch(() => {});
      if (status === 'delivered') whatsapp.notifyOrderDelivered(order, userObj).catch(() => {});
      if (status === 'cancelled') whatsapp.notifyOrderCancelled(order, userObj).catch(() => {});
      // Email on key status changes
      const emailStatuses = ['confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
      if (emailStatuses.includes(status) && userObj?.email) {
        sendShippingUpdate({ order, user: userObj }).catch((e) =>
          console.error('[Orders] email error:', e.message)
        );
      }
    }

    res.json({ order });
  } catch (err) { next(err); }
});

// ── PUT /admin/orders/:id/address ─────────────────────────────────────────────
router.put('/:id/address', async (req, res, next) => {
  try {
    const fields = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'country'];
    const update = {};
    fields.forEach((f) => { if (req.body[f] !== undefined) update[`shippingAddress.${f}`] = req.body[f]; });

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: update,
        $push: {
          'tracking.history': {
            status: 'address_updated',
            timestamp: new Date(),
            description: 'Shipping address updated by admin',
          },
        },
      },
      { new: true },
    ).populate('user', 'name email phone');

    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    res.json({ order });
  } catch (err) { next(err); }
});

// ── PATCH /admin/orders/:id/tracking ─────────────────────────────────────────
router.patch('/:id/tracking', async (req, res, next) => {
  try {
    const { carrier, trackingId, url } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { 'tracking.carrier': carrier, 'tracking.trackingId': trackingId, 'tracking.url': url } },
      { new: true },
    );
    if (!order) return next(new AppError('Order not found', 404));
    res.json({ order });
  } catch (err) { next(err); }
});

// ── PATCH /admin/orders/:id/status (legacy alias) ────────────────────────────
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
      { new: true },
    );
    res.json({ order });
  } catch (err) { next(err); }
});

// ── PUT /admin/orders/:id (general update — kept for backwards compat) ────────
router.put('/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'paymentStatus', 'tracking', 'internalNotes'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const prev = await Order.findById(req.params.id);
    if (!prev) throw new AppError('Order not found', 404, 'NOT_FOUND');

    if (update.status === 'delivered' && prev.status !== 'delivered') {
      if (prev.paymentMethod === 'cod') update.paymentStatus = 'paid';
      update.deliveredAt = new Date();
    }

    const historyEntry = update.status && update.status !== prev.status
      ? { status: update.status, timestamp: new Date(), description: req.body.note || '' }
      : null;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { ...update, ...(historyEntry && { $push: { 'tracking.history': historyEntry } }) },
      { new: true },
    );

    if (update.status) {
      await applyEarnings(prev, update.status).catch((e) =>
        console.error('[Orders] earnings error:', e.message),
      );
    }

    res.json({ order });
  } catch (err) { next(err); }
});

// ── POST /admin/orders/:id/ship ───────────────────────────────────────────────
router.post('/:id/ship', async (req, res, next) => {
  try {
    const { carrier = 'auto', waybill } = req.body;
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (['delivered', 'cancelled', 'returned'].includes(order.status)) {
      throw new AppError('Cannot ship an order with status: ' + order.status, 400, 'INVALID_STATUS');
    }
    const result = await createShipment({ order, carrier, waybill });
    const updated = await Order.findByIdAndUpdate(
      order._id,
      {
        status: 'shipped',
        'tracking.carrier': result.carrier,
        'tracking.trackingId': result.trackingId,
        'tracking.url': result.url,
        $push: {
          'tracking.history': {
            status: 'shipped',
            timestamp: new Date(),
            description: `Shipped via ${result.carrier}${result.trackingId ? ' · AWB: ' + result.trackingId : ''}`,
          },
        },
      },
      { new: true },
    );
    res.json({ order: updated, shipment: result });
  } catch (err) { next(err); }
});

// ── PUT /admin/orders/:id/affiliate ──────────────────────────────────────────
router.put('/:id/affiliate', async (req, res, next) => {
  try {
    const { affiliateCode } = req.body;
    if (!affiliateCode) throw new AppError('affiliateCode required', 400, 'MISSING_FIELDS');

    const affiliate = await User.findOne({
      'affiliateProfile.referralCode': affiliateCode.toUpperCase().trim(),
      role: 'affiliate',
    });
    if (!affiliate) throw new AppError('Affiliate not found for that code', 404, 'NOT_FOUND');

    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    const rate = affiliate.affiliateProfile?.commissionRate ?? 5;
    const commission = parseFloat((order.totalAmount * rate / 100).toFixed(2));

    const wasAlreadyAttributed = !!order.affiliateId;
    const wasDelivered = order.status === 'delivered';

    if (wasAlreadyAttributed && wasDelivered && order.affiliateCommission > 0) {
      await User.findByIdAndUpdate(order.affiliateId, {
        $inc: { 'affiliateProfile.totalEarnings': -order.affiliateCommission },
      });
    }

    order.affiliateId = affiliate._id;
    order.affiliateCommission = commission;
    await order.save();

    if (wasDelivered) {
      await User.findByIdAndUpdate(affiliate._id, {
        $inc: { 'affiliateProfile.totalEarnings': commission },
      });
    }

    res.json({ order, affiliate: { name: affiliate.name, commission } });
  } catch (err) { next(err); }
});

module.exports = router;
