const router = require('express').Router();
const crypto = require('crypto');
const { verifyPayment } = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../config/env');
const { sendOrderConfirmation, sendAdminNewOrderEmail, sendVendorNewOrderEmail } = require('../services/emailService');
const { createVendorCommissions, createAffiliateCommission } = require('../services/commissionService');
const notif = require('../utils/notificationHelper');
const whatsapp = require('../services/whatsappService');

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
          createVendorCommissions(order).catch((err) => console.error('[Commission] vendor failed (webhook):', err.message));
          if (order.affiliateId) createAffiliateCommission(order, order.affiliateId).catch((err) => console.error('[Commission] affiliate failed (webhook):', err.message));

          User.findById(order.user).then((user) => {
            if (user) {
              sendOrderConfirmation({ order, user }).catch(() => {});
              sendAdminNewOrderEmail({ order, customer: user }).catch(() => {});
              whatsapp.notifyOrderPlaced(order, user).catch(() => {});
            }
          });

          notif.notifyAdminNewOrder({ order }).catch(() => {});
          if (order.user) {
            notif.notifyUserPaymentSuccess({ userId: order.user, order, amount: order.totalAmount }).catch(() => {});
          }

          const vendorItemsMap = {};
          for (const item of order.items) {
            if (item.vendorId) {
              const key = item.vendorId.toString();
              if (!vendorItemsMap[key]) vendorItemsMap[key] = [];
              vendorItemsMap[key].push(item);
            }
          }
          for (const [vendorId, vendorItems] of Object.entries(vendorItemsMap)) {
            notif.notifyVendorNewOrder({ vendorUserId: vendorId, order, items: vendorItems }).catch(() => {});
            User.findById(vendorId).then((v) => {
              if (v?.email) sendVendorNewOrderEmail({ order, vendorEmail: v.email, vendorName: v.vendorProfile?.storeName || v.name || 'Vendor', vendorItems }).catch(() => {});
            }).catch(() => {});
          }
        }
      }
    }

    if (event === 'payment.failed') {
      const razorpayOrderId = req.body.payload?.payment?.entity?.order_id;
      if (razorpayOrderId) {
        const order = await Order.findOneAndUpdate(
          { razorpayOrderId, paymentStatus: 'pending' },
          { paymentStatus: 'failed', status: 'cancelled', cancellation: { reason: 'Payment failed', cancelledAt: new Date() } },
          { new: true }
        );
        // Restore stock so items are available to other customers
        if (order) {
          await Promise.all(
            order.items.map((item) =>
              Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
            )
          );
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
