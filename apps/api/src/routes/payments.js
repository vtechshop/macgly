const router = require('express').Router();
const crypto = require('crypto');
const { verifyPayment } = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const Order = require('../models/Order');
const User = require('../models/User');
const { RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../config/env');
const { sendOrderConfirmation } = require('../services/emailService');
const { createVendorCommissions, createAffiliateCommission } = require('../services/commissionService');

router.post('/verify', authenticate, verifyPayment);

// Razorpay webhook — raw body needed for signature validation
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;
    if (!signature || !secret) return res.status(400).json({ ok: false });

    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
      .digest('hex');

    if (signature !== expected) return res.status(400).json({ error: 'Invalid signature' });

    const event = req.body.event;
    if (event === 'payment.captured') {
      const paymentId = req.body.payload?.payment?.entity?.id;
      const razorpayOrderId = req.body.payload?.payment?.entity?.order_id;
      if (razorpayOrderId) {
        const order = await Order.findOneAndUpdate(
          { razorpayOrderId, paymentStatus: { $ne: 'paid' } },
          { paymentStatus: 'paid', status: 'confirmed', razorpayPaymentId: paymentId },
          { new: true }
        );
        if (order) {
          createVendorCommissions(order).catch(() => {});
          if (order.affiliateId) createAffiliateCommission(order, order.affiliateId).catch(() => {});
          User.findById(order.user).then((user) => {
            if (user) sendOrderConfirmation({ order, user }).catch(() => {});
          });
        }
      }
    }

    if (event === 'payment.failed') {
      const razorpayOrderId = req.body.payload?.payment?.entity?.order_id;
      if (razorpayOrderId) {
        await Order.findOneAndUpdate(
          { razorpayOrderId, paymentStatus: 'pending' },
          { paymentStatus: 'failed' }
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
