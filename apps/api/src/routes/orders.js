const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { createOrder, getOrders, getOrder, cancelOrder } = require('../controllers/orderController');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');

// Public: track order by orderId + phone (no auth required)
router.get('/track', async (req, res, next) => {
  try {
    const { orderId, phone } = req.query;
    if (!orderId || !phone) return next(new AppError('orderId and phone are required', 400));

    const order = await Order.findOne({ orderId: orderId.trim() })
      .populate('items.product', 'title images');

    if (!order) return next(new AppError('Order not found', 404));

    // Verify phone matches shipping address
    const orderPhone = order.shippingAddress?.phone?.replace(/\D/g, '');
    const queryPhone = phone.trim().replace(/\D/g, '');
    if (!orderPhone || orderPhone.slice(-10) !== queryPhone.slice(-10)) {
      return next(new AppError('Order not found or phone number does not match', 404));
    }

    res.json({
      order: {
        orderId: order.orderId,
        status: order.status,
        createdAt: order.createdAt,
        tracking: order.tracking,
        items: (order.items || []).map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          image: item.product?.images?.[0] || item.image,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/:id/cancel', cancelOrder);

module.exports = router;
