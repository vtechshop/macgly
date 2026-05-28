const router   = require('express').Router();
const Order    = require('../../models/Order');
const Product  = require('../../models/Product');
const User     = require('../../models/User');
const Warranty = require('../../models/Warranty');
const AppError = require('../../utils/AppError');

// ── helpers ──────────────────────────────────────────────────────────────────

function generateManualId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MAN-${ts}-${rand}`;
}

async function activateWarranties(order, adminId) {
  const now = new Date();
  for (const item of order.items) {
    const product = await Product.findById(item.product).select('hasWarranty warranty').lean();
    if (!product?.hasWarranty || !product.warranty) continue;

    const { duration = 12, durationType = 'months' } = product.warranty;
    let months;
    if (durationType === 'lifetime') months = 36500 / 30;
    else if (durationType === 'years') months = duration * 12;
    else months = duration;

    const expiryDate = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    // Use the linked user or fall back to admin (walk-in customer)
    const warrantyUser = order.user || adminId;

    try {
      await Warranty.create({
        user:                 warrantyUser,
        product:              item.product,
        order:                order._id,
        serialNumber:         item.serialNumber || undefined,
        purchaseDate:         now,
        expiryDate,
        warrantyPeriodMonths: Math.round(months),
        status:               'active',
      });
    } catch (e) {
      // Duplicate serial? log and continue
      console.error('[ManualOrders] Warranty create error:', e.message);
    }
  }
}

// ── GET /admin/manual-orders ──────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, source, search } = req.query;
    const filter = { source: { $in: ['in-store', 'phone'] } };
    if (source && source !== 'all') filter.source = source;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { orderId: re },
        { customerPhone: re },
        { customerName: re },
        { 'shippingAddress.name': re },
      ];
    }

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

    // Warranty counts via aggregate
    const orderIds = orders.map((o) => o._id);
    const warrantyCounts = await Warranty.aggregate([
      { $match: { order: { $in: orderIds } } },
      { $group: { _id: '$order', count: { $sum: 1 } } },
    ]);
    const wMap = {};
    warrantyCounts.forEach(({ _id, count }) => { wMap[_id.toString()] = count; });
    const enriched = orders.map((o) => ({ ...o, warrantyCount: wMap[o._id.toString()] || 0 }));

    // Stats
    const [statsResult] = await Promise.all([
      Order.aggregate([
        { $match: { source: { $in: ['in-store', 'phone'] } } },
        {
          $group: {
            _id: null,
            total:   { $sum: 1 },
            inStore: { $sum: { $cond: [{ $eq: ['$source', 'in-store'] }, 1, 0] } },
            phone:   { $sum: { $cond: [{ $eq: ['$source', 'phone'] }, 1, 0] } },
            revenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
          },
        },
      ]),
    ]);

    const withWarranty = await Warranty.aggregate([
      { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'ord' } },
      { $unwind: '$ord' },
      { $match: { 'ord.source': { $in: ['in-store', 'phone'] } } },
      { $group: { _id: '$order' } },
      { $count: 'n' },
    ]);

    const stats = {
      total:       statsResult[0]?.total   || 0,
      inStore:     statsResult[0]?.inStore || 0,
      phone:       statsResult[0]?.phone   || 0,
      withWarranty: withWarranty[0]?.n     || 0,
      revenue:     statsResult[0]?.revenue || 0,
    };

    res.json({
      orders: enriched,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      stats,
    });
  } catch (err) { next(err); }
});

// ── POST /admin/manual-orders ─────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      customerName, customerPhone, customerEmail,
      items, paymentMethod = 'cash', amountPaid,
      source = 'in-store', notes, internalNotes, discount = 0,
    } = req.body;

    if (!customerName?.trim()) throw new AppError('Customer name is required', 400, 'MISSING_FIELDS');
    if (!customerPhone?.trim()) throw new AppError('Customer phone is required', 400, 'MISSING_FIELDS');
    if (!items?.length) throw new AppError('At least one item is required', 400, 'MISSING_FIELDS');

    // Try to link a registered customer
    let customer = null;
    if (customerEmail?.trim()) {
      customer = await User.findOne({ email: customerEmail.toLowerCase().trim() });
    }

    // Build order items
    const orderItems = [];
    let subtotal = 0;
    for (const { productId, qty = 1, price: itemPrice, serialNumber } of items) {
      const product = await Product.findById(productId).lean();
      if (!product) throw new AppError(`Product not found: ${productId}`, 404, 'NOT_FOUND');
      const unitPrice = parseFloat(itemPrice) || product.price || 0;
      const quantity  = parseInt(qty) || 1;
      orderItems.push({
        product:      product._id,
        title:        product.title,
        sku:          product.sku || '',
        image:        product.images?.[0] || '',
        price:        unitPrice,
        quantity,
        vendorId:     product.vendorId || null,
        vendorEarning: 0,
        platformFee:  0,
        serialNumber: serialNumber?.trim() || '',
      });
      subtotal += unitPrice * quantity;
    }

    const discountAmt  = parseFloat(discount) || 0;
    const totalAmount  = Math.max(0, subtotal - discountAmt);
    const now          = new Date();

    const order = await Order.create({
      orderId:        generateManualId(),
      user:           customer?._id || null,
      customerName:   customerName.trim(),
      customerPhone:  customerPhone.trim(),
      source,
      items:          orderItems,
      subtotal,
      discount:       discountAmt,
      shippingCharge: 0,
      gstAmount:      0,
      totalAmount,
      paymentMethod,
      paymentStatus:  'paid',
      status:         'delivered',
      deliveredAt:    now,
      notes:          notes?.trim() || '',
      internalNotes:  internalNotes ? `${internalNotes}\n[Manual order by admin: ${req.user._id}]` : `Manual order by admin: ${req.user._id}`,
      tracking: {
        history: [
          { status: 'placed',    timestamp: now, description: 'Order placed manually by admin' },
          { status: 'paid',      timestamp: now, description: `Payment received — ${paymentMethod}` },
          { status: 'delivered', timestamp: now, description: 'Handed over to customer in-store' },
        ],
      },
    });

    // Auto-activate warranties
    await activateWarranties(order, req.user._id);

    res.status(201).json({ order });
  } catch (err) { next(err); }
});

// ── PUT /admin/manual-orders/:id ──────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (!['in-store', 'phone'].includes(order.source)) {
      throw new AppError('Not a manual order', 400, 'INVALID_REQUEST');
    }
    if (order.status === 'cancelled') {
      throw new AppError('Cannot edit a cancelled order', 400, 'INVALID_REQUEST');
    }

    const allowed = ['customerName', 'customerPhone', 'source', 'paymentMethod', 'notes', 'internalNotes'];
    const update  = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    update.$push = {
      'tracking.history': { status: 'updated', timestamp: new Date(), description: 'Order edited by admin' },
    };

    const updated = await Order.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name email phone');

    // Sync customer info in any linked warranties
    if (update.customerPhone) {
      await Warranty.updateMany({ order: order._id }, { $set: {} }); // placeholder; extend if Warranty stores phone
    }

    res.json({ order: updated });
  } catch (err) { next(err); }
});

// ── PUT /admin/manual-orders/:id/cancel ───────────────────────────────────────
router.put('/:id/cancel', async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) throw new AppError('Cancellation reason is required', 400, 'MISSING_REASON');

    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (!['in-store', 'phone'].includes(order.source)) {
      throw new AppError('Not a manual order', 400, 'INVALID_REQUEST');
    }
    if (order.status === 'cancelled') {
      throw new AppError('Order is already cancelled', 400, 'ALREADY_CANCELLED');
    }

    const now = new Date();
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status:        'cancelled',
        paymentStatus: 'refunded',
        cancellation:  { reason: reason.trim(), cancelledAt: now, cancelledBy: req.user._id },
        $push: {
          'tracking.history': { status: 'cancelled', timestamp: now, description: `Cancelled: ${reason.trim()}` },
        },
      },
      { new: true },
    );

    // Void all associated warranties
    const result = await Warranty.updateMany(
      { order: order._id },
      { status: 'void' },
    );

    res.json({ success: true, order: updated, warrantiesVoided: result.modifiedCount });
  } catch (err) { next(err); }
});

module.exports = router;
