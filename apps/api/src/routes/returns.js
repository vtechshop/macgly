const router = require('express').Router();
const Return = require('../models/Return');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');
const { resolveReturnLines } = require('../utils/returnLines');

router.use(authenticate);

// Request a return
router.post('/', async (req, res, next) => {
  try {
    const { orderId, items, reason, description } = req.body;
    if (!orderId || !reason) throw new AppError('orderId and reason required', 400, 'MISSING_FIELDS');

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (!['delivered'].includes(order.status)) {
      throw new AppError('Returns can only be requested for delivered orders', 400, 'INVALID_STATUS');
    }
    if (order.deliveredAt) {
      const daysSince = (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 30) {
        throw new AppError('Return window has closed. Returns must be raised within 30 days of delivery.', 400, 'RETURN_WINDOW_CLOSED');
      }
    }
    const existing = await Return.findOne({ order: orderId });
    if (existing) throw new AppError('Return already requested for this order', 400, 'DUPLICATE');

    // Resolve the requested lines against the order. A refund must be worth what
    // was actually sent back — previously every return, however partial, was
    // recorded at the full order total.
    const { returnItems, refundAmount } = resolveReturnLines(order, items);

    const ret = await Return.create({
      order: orderId,
      user: req.user._id,
      items: returnItems,
      reason,
      description,
      refundAmount,
    });

    res.status(201).json({ return: ret });
  } catch (err) { next(err); }
});

// My returns
router.get('/my', async (req, res, next) => {
  try {
    const returns = await Return.find({ user: req.user._id })
      .populate('order', 'orderId totalAmount createdAt')
      .sort({ createdAt: -1 });
    res.json({ returns });
  } catch (err) { next(err); }
});

// Single return
router.get('/:id', async (req, res, next) => {
  try {
    const ret = await Return.findOne({ _id: req.params.id, user: req.user._id })
      .populate('order', 'orderId totalAmount items shippingAddress');
    if (!ret) throw new AppError('Return not found', 404, 'NOT_FOUND');
    res.json({ return: ret });
  } catch (err) { next(err); }
});

module.exports = router;
