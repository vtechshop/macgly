const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const { generateOrderId } = require('../utils/helpers');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../config/env');
const { sendOrderConfirmation } = require('../services/emailService');
const notif = require('../utils/notificationHelper');

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
    const shippingCharge = Math.min(Math.max(parseInt(req.body.shippingCharge) || 0, 0), 500);
    const totalAmount = Math.max(0, subtotal - discount + shippingCharge);

    const orderId = generateOrderId();

    let razorpayOrder = null;
    if (paymentMethod === 'razorpay' && razorpay) {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: 'INR',
        receipt: orderId,
      });
    }

    const totalPlatformFee = parseFloat(items.reduce((sum, i) => sum + (i.platformFee || 0), 0).toFixed(2));

    // Affiliate attribution — prefer referredBy (registration link), fall back to aff_ref cookie (tracking link)
    let affiliateId;
    let affiliateCommission = 0;
    const buyer = await User.findById(req.user._id);

    let affiliate = null;
    if (buyer?.referredBy) {
      // Permanent attribution from registration link
      affiliate = await User.findById(buyer.referredBy);
    } else {
      // Priority: server-side stored ref (most reliable) → body param → cookie
      const refCode = buyer?.pendingAffiliateRef || req.body.affiliateRef || req.cookies?.aff_ref;
      if (refCode) {
        affiliate = await User.findOne({ 'affiliateProfile.referralCode': refCode, role: 'affiliate' });
      }
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

    // Send COD confirmation email async
    if (paymentMethod === 'cod') {
      const User = require('../models/User');
      User.findById(req.user._id).then((u) => {
        if (u) sendOrderConfirmation({ order, user: u }).catch(() => {});
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
        }
      } catch (e) {
        console.error('[createOrder] notification error:', e.message);
      }
    })();

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

    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { paymentStatus: 'paid', status: 'confirmed', razorpayPaymentId: razorpay_payment_id },
      { new: true }
    );
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    // Send confirmation email + fire notifications async — don't block response
    const User = require('../models/User');
    User.findById(order.user).then((user) => {
      if (user) sendOrderConfirmation({ order, user }).catch(console.error);
    });

    // Payment success notification to customer
    if (order.user) {
      notif.notifyUserPaymentSuccess({ userId: order.user, order, amount: order.totalAmount }).catch(() => {});
    }
    // Notify admins order is paid
    notif.notifyAdminNewOrder({ order }).catch(() => {});

    res.json({ order });
  } catch (err) { next(err); }
}

async function getOrders(req, res, next) {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { user: req.user._id };

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
    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage', 400, 'INVALID_STATUS');
    }
    order.status = 'cancelled';
    await order.save();

    // Restore stock
    await Promise.all(order.items.map((item) =>
      Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
    ));

    res.json({ order });
  } catch (err) { next(err); }
}

module.exports = { createOrder, verifyPayment, getOrders, getOrder, cancelOrder };
