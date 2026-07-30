const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Setting = require('../models/Setting');
const abandonedCartService = require('../services/abandonedCartService');
const AppError = require('../utils/AppError');
const { generateOrderId } = require('../utils/helpers');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../config/env');
const { sendOrderConfirmation, sendVendorNewOrderEmail, sendAdminNewOrderEmail, sendShippingUpdate, sendAdminOrderCancelledEmail } = require('../services/emailService');
const notif = require('../utils/notificationHelper');
const whatsapp = require('../services/whatsappService');
const { createVendorCommissions, createAffiliateCommission } = require('../services/commissionService');

const razorpay = RAZORPAY_KEY_ID
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

async function createOrder(req, res, next) {
  try {
    const { shippingAddress, paymentMethod = 'razorpay', notes } = req.body;
    const { name, phone, line1, city, state, pincode } = shippingAddress || {};
    if (!name?.trim() || !phone?.trim() || !line1?.trim() || !city?.trim() || !state?.trim() || !pincode?.trim()) {
      throw new AppError('All address fields are required (name, phone, address, city, state, pincode)', 400, 'MISSING_FIELDS');
    }
    if (!/^\d{10}$/.test(phone.replace(/[\s+\-() ]/g, ''))) {
      throw new AppError('Enter a valid 10-digit phone number', 400, 'INVALID_PHONE');
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      throw new AppError('Enter a valid 6-digit pincode', 400, 'INVALID_PINCODE');
    }

    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) {
      // Try migrating anonymous cart
      const anonCart = await Cart.findOne({ sessionId: req.cookies?.sessionId || 'anon' });
      if (anonCart) {
        anonCart.user = req.user._id;
        anonCart.sessionId = undefined;
        await anonCart.save();
        await anonCart.populate('items.product');
        cart = anonCart;
      }
    }
    if (!cart?.items?.length) throw new AppError('Cart is empty', 400, 'EMPTY_CART');

    // Fetch vendor profiles once for commission rate lookup
    const User = require('../models/User');
    const uniqueVendorIds = [...new Set(cart.items.map((i) => i.product?.vendorId?.toString()).filter(Boolean))];
    const vendors = await User.find({ _id: { $in: uniqueVendorIds } }).select('vendorProfile');
    const vendorMap = Object.fromEntries(vendors.map((v) => [v._id.toString(), v]));

    // Validate stock and build order items
    const items = [];
    for (const item of cart.items) {
      const product = item.product;
      if (!product || !product.published) throw new AppError(`${item.title} is no longer available`, 400, 'PRODUCT_UNAVAILABLE');
      if (product.stock < item.quantity) throw new AppError(`Insufficient stock for ${product.title}`, 400, 'OUT_OF_STOCK');
      const itemTotal = product.price * item.quantity;
      const platformRate = vendorMap[product.vendorId?.toString()]?.vendorProfile?.commissionRate ?? 10;
      const platformFee = parseFloat((itemTotal * platformRate / 100).toFixed(2));
      items.push({
        product: product._id,
        title: product.title,
        sku: product.sku,
        price: product.price,
        quantity: item.quantity,
        gstRate: product.gstRate ?? 18,
        image: product.images?.[0],
        vendorId: product.vendorId,
        platformFee,
        vendorEarning: parseFloat((itemTotal - platformFee).toFixed(2)),
      });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    // GST is inclusive in price: gstAmount = price * qty * rate / (100 + rate)
    const gstAmount = parseFloat(
      items.reduce((sum, i) => sum + (i.price * i.quantity * i.gstRate) / (100 + i.gstRate), 0).toFixed(2)
    );
    const discount = cart.coupon?.discount || 0;
    const [freeThreshold, defaultRate] = await Promise.all([
      Setting.get('shipping.free_threshold', 5000),
      Setting.get('shipping.default_rate', 70),
    ]);
    const serverShipping = subtotal >= parseFloat(freeThreshold) ? 0 : parseFloat(defaultRate);
    // Use client-calculated shipping if provided and subtotal is below free threshold; else use server default
    const clientShipping = parseFloat(req.body.shippingCharge);
    const shippingCharge = subtotal >= parseFloat(freeThreshold)
      ? 0
      : (Number.isFinite(clientShipping) && clientShipping >= 0 ? clientShipping : serverShipping);
    const totalAmount = Math.max(0, subtotal - discount + shippingCharge);

    const orderId = generateOrderId();

    if (paymentMethod === 'cod') {
      throw new AppError('Cash on Delivery is not available', 400, 'COD_DISABLED');
    }

    let razorpayOrder = null;
    if (paymentMethod === 'razorpay' && razorpay) {
      try {
        razorpayOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: 'INR',
          receipt: orderId,
        });
      } catch (rzpErr) {
        console.error('[Razorpay order error]', JSON.stringify(rzpErr?.error || rzpErr));
        throw new AppError(rzpErr?.error?.description || 'Payment gateway error', 502, 'PAYMENT_GATEWAY_ERROR');
      }
    }

    const totalPlatformFee = parseFloat(items.reduce((sum, i) => sum + (i.platformFee || 0), 0).toFixed(2));

    // Affiliate attribution — 24-hour click window only (Amazon-style, no permanent attribution)
    let affiliateId;
    let affiliateCommission = 0;
    const buyer = await User.findById(req.user._id);

    let affiliate = null;
    // pendingAffiliateRef is set at registration (first-order only) — treat as a one-time 24hr click
    const refCode = buyer?.pendingAffiliateRef || req.body.affiliateRef || req.cookies?.aff_ref;
    if (refCode) {
      affiliate = await User.findOne({ 'affiliateProfile.referralCode': refCode, role: 'affiliate' });
    }

    if (affiliate?.role === 'affiliate') {
      const rate = affiliate.affiliateProfile?.commissionRate ?? 5;
      affiliateCommission = parseFloat((totalAmount * rate / 100).toFixed(2));
      affiliateId = affiliate._id;
    }

    const order = await Order.create({
      orderId,
      user: req.user._id,
      items,
      shippingAddress,
      subtotal,
      gstAmount,
      discount,
      shippingCharge,
      totalAmount,
      coupon: cart.coupon ? { code: cart.coupon.code, discount: cart.coupon.discount } : undefined,
      paymentMethod,
      razorpayOrderId: razorpayOrder?.id,
      totalPlatformFee,
      affiliateId,
      affiliateCommission,
      notes,
    });

    // Clear pending affiliate ref so it doesn't apply to the next order too
    if (buyer?.pendingAffiliateRef) {
      User.findByIdAndUpdate(req.user._id, { pendingAffiliateRef: null }).catch(() => {});
    }

    // Atomically decrement stock — fails if stock dropped below required quantity between checkout and now
    const stockUpdates = await Promise.all(items.map((item) =>
      Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      )
    ));
    if (stockUpdates.some((r) => r === null)) {
      await Order.findByIdAndDelete(order._id);
      throw new AppError('One or more items went out of stock. Please review your cart.', 409, 'OUT_OF_STOCK');
    }

    // COD: create commission records + send confirmation
    if (paymentMethod === 'cod') {
      createVendorCommissions(order).catch(() => {});
      if (affiliateId) createAffiliateCommission(order, affiliateId).catch(() => {});
      const User = require('../models/User');
      User.findById(req.user._id).then((u) => {
        if (u) {
          sendOrderConfirmation({ order, user: u }).catch(() => {});
          sendAdminNewOrderEmail({ order, customer: u }).catch(() => {});
          whatsapp.notifyOrderPlaced(order, u).catch(() => {});
        }
      });
    }

    // Fire notifications async — don't block response
    (async () => {
      try {
        // Notify all admins of the new order
        await notif.notifyAdminNewOrder({ order });

        // Notify each unique vendor with their items
        const vendorItemsMap = {};
        for (const item of order.items) {
          if (item.vendorId) {
            const key = item.vendorId.toString();
            if (!vendorItemsMap[key]) vendorItemsMap[key] = [];
            vendorItemsMap[key].push(item);
          }
        }
        for (const [vendorId, vendorItems] of Object.entries(vendorItemsMap)) {
          await notif.notifyVendorNewOrder({ vendorUserId: vendorId, order, items: vendorItems });
          if (paymentMethod === 'cod') {
            const User = require('../models/User');
            User.findById(vendorId).then((v) => {
              if (v?.email) {
                sendVendorNewOrderEmail({ order, vendorEmail: v.email, vendorName: v.vendorProfile?.storeName || v.name || 'Vendor', vendorItems }).catch(() => {});
              }
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[createOrder] notification error:', e.message);
      }
    })();

    // Track coupon usage
    if (cart.coupon?.code) {
      Coupon.findOneAndUpdate(
        { code: cart.coupon.code },
        { $inc: { usedCount: 1 }, $push: { usedBy: { user: req.user._id } } }
      ).catch(() => {});
    }

    // Mark any abandoned cart as recovered
    abandonedCartService.markRecovered(req.user._id).catch(() => {});

    // Clear cart
    await Cart.deleteOne({ user: req.user._id });

    res.status(201).json({
      order,
      razorpayOrder,
      razorpayKey: RAZORPAY_KEY_ID,
    });
  } catch (err) { next(err); }
}

async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError('Payment verification data missing', 400, 'MISSING_FIELDS');
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');
    if (expected !== razorpay_signature) throw new AppError('Payment verification failed', 400, 'PAYMENT_INVALID');

    // Guard: if webhook already processed this payment, skip emails/notifications (prevent duplicates)
    let order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, paymentStatus: { $ne: 'paid' } },
      { paymentStatus: 'paid', status: 'confirmed', razorpayPaymentId: razorpay_payment_id },
      { new: true }
    );
    const alreadyProcessed = !order;
    if (!order) order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    if (!alreadyProcessed) {
      // Create commission records for vendor and affiliate
      createVendorCommissions(order).catch(() => {});
      if (order.affiliateId) createAffiliateCommission(order, order.affiliateId).catch(() => {});

      // Send confirmation email + fire notifications async — don't block response
      const User = require('../models/User');
      User.findById(order.user).then((user) => {
        if (user) {
          sendOrderConfirmation({ order, user }).catch(console.error);
          sendAdminNewOrderEmail({ order, customer: user }).catch(() => {});
          whatsapp.notifyOrderPlaced(order, user).catch(() => {});
        }
      });

      // Vendor emails
      (async () => {
        try {
          const User = require('../models/User');
          const vendorItemsMap = {};
          for (const item of order.items) {
            if (item.vendorId) {
              const key = item.vendorId.toString();
              if (!vendorItemsMap[key]) vendorItemsMap[key] = [];
              vendorItemsMap[key].push(item);
            }
          }
          for (const [vendorId, vendorItems] of Object.entries(vendorItemsMap)) {
            User.findById(vendorId).then((v) => {
              if (v?.email) sendVendorNewOrderEmail({ order, vendorEmail: v.email, vendorName: v.vendorProfile?.storeName || v.name || 'Vendor', vendorItems }).catch(() => {});
            }).catch(() => {});
          }
        } catch (e) {
          console.error('[verifyPayment] vendor email error:', e.message);
        }
      })();

      // Payment success notification to customer
      if (order.user) {
        notif.notifyUserPaymentSuccess({ userId: order.user, order, amount: order.totalAmount }).catch(() => {});
      }
      // Notify admins order is paid
      notif.notifyAdminNewOrder({ order }).catch(() => {});
    }

    res.json({ order });
  } catch (err) { next(err); }
}

async function getOrders(req, res, next) {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { user: req.user._id, paymentStatus: { $ne: 'pending' } };

    if (status === 'placed') {
      filter.status = { $in: ['placed', 'paid', 'confirmed', 'processing', 'packed'] };
    } else if (status === 'shipped') {
      filter.status = { $in: ['shipped', 'out_for_delivery'] };
    } else if (status && status !== 'all') {
      filter.status = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
}

async function getOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    res.json({ order });
  } catch (err) { next(err); }
}

async function cancelOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (!['pending', 'pending_payment', 'confirmed'].includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage. Contact support if already shipped.', 400, 'INVALID_STATUS');
    }

    order.status = 'cancelled';
    order.cancellation = { reason: 'Cancelled by customer', cancelledAt: new Date(), cancelledBy: req.user._id };
    await order.save();

    // Restore stock
    await Promise.all(order.items.map((item) =>
      Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
    ));

    const wasPaid = order.paymentStatus === 'paid';
    if (wasPaid) {
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'pending_refund' });
    }

    // Notify customer
    sendShippingUpdate({ order, user: req.user }).catch(() => {});
    whatsapp.notifyOrderCancelled(order, req.user).catch(() => {});
    // Notify admin if refund is needed
    if (wasPaid) sendAdminOrderCancelledEmail({ order, customer: req.user }).catch(() => {});

    res.json({ order, refundPending: wasPaid });
  } catch (err) { next(err); }
}

module.exports = { createOrder, verifyPayment, getOrders, getOrder, cancelOrder };
