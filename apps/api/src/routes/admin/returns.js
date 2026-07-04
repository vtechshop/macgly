const router = require('express').Router();
const Razorpay = require('razorpay');
const Return = require('../../models/Return');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const AppError = require('../../utils/AppError');
const { applyEarnings } = require('../../utils/earningsHelper');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../../config/env');

router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [returns, total] = await Promise.all([
      Return.find(filter)
        .populate('user', 'name email')
        .populate('order', 'orderId totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Return.countDocuments(filter),
    ]);
    res.json({ returns, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, adminNote, refundAmount } = req.body;
    if (!status) throw new AppError('status is required', 400, 'MISSING_FIELDS');

    const ret = await Return.findById(req.params.id);
    if (!ret) throw new AppError('Return not found', 404, 'NOT_FOUND');

    const order = await Order.findById(ret.order);

    // On approved or refunded: reverse vendor/affiliate earnings and mark order returned
    if (['approved', 'refunded'].includes(status) && order && order.status === 'delivered') {
      await applyEarnings(order, 'returned').catch((e) =>
        console.error('[Returns] earnings reversal error:', e.message)
      );
      await Order.findByIdAndUpdate(order._id, { status: 'returned' });
    }

    // On refunded: trigger actual Razorpay refund + restore stock + mark payment refunded
    if (status === 'refunded' && order) {
      // 1. Razorpay refund
      if (RAZORPAY_KEY_ID && order.razorpayPaymentId) {
        try {
          const rz = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
          const amtPaise = Math.round((refundAmount || ret.refundAmount || order.totalAmount) * 100);
          await rz.payments.refund(order.razorpayPaymentId, { amount: amtPaise });
          console.log(`[Returns] Razorpay refund initiated for order ${order.orderId}`);
        } catch (rzpErr) {
          // Log but don't block — admin can retry manually in Razorpay dashboard
          console.error('[Returns] Razorpay refund error:', JSON.stringify(rzpErr?.error || rzpErr));
        }
      }

      // 2. Mark order payment as refunded
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'refunded' });

      // 3. Restore stock — use specific return items if provided, else all order items
      const itemsToRestore = ret.items?.length ? ret.items : (order.items || []);
      await Promise.all(
        itemsToRestore.map((item) => {
          const productId = item.product || item.productId;
          const qty = item.quantity || 1;
          if (!productId) return Promise.resolve();
          return Product.findByIdAndUpdate(productId, { $inc: { stock: qty } });
        })
      );
    }

    const update = {
      status,
      ...(adminNote && { adminNote }),
      ...(refundAmount !== undefined && { refundAmount }),
    };
    if (['approved', 'rejected', 'refunded'].includes(status)) update.resolvedAt = new Date();

    const updatedRet = await Return.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name email')
      .populate('order', 'orderId');

    res.json({ return: updatedRet });
  } catch (err) { next(err); }
});

module.exports = router;
