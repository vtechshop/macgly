const router = require('express').Router();
const Return = require('../models/Return');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

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
    const existing = await Return.findOne({ order: orderId });
    if (existing) throw new AppError('Return already requested for this order', 400, 'DUPLICATE');

    const ret = await Return.create({
      order: orderId,
      user: req.user._id,
      items: items || [],
      reason,
      description,
      refundAmount: order.totalAmount,
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
