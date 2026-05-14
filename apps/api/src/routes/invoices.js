const router = require('express').Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { generateInvoiceHTML } = require('../services/invoiceService');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

// GET /api/invoices/:orderId — authenticated customer or admin
router.get('/:orderId', authenticate, async (req, res, next) => {
  try {
    const filter = { orderId: req.params.orderId };
    if (req.user.role !== 'admin') filter.user = req.user._id;
    const order = await Order.findOne(filter);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    const user = await User.findById(order.user).select('name email phone');
    const html = generateInvoiceHTML(order, user);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

module.exports = router;
