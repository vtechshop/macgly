const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Setting = require('../models/Setting');
const abandonedCartService = require('../services/abandonedCartService');
const { resolveCart } = require('../services/cartService');
const AppError = require('../utils/AppError');
const { generateOrderId } = require('../utils/helpers');
const { resolveTaxRate, resolveSupplierStateCode, splitGst, computeCommission } = require('../utils/tax');
const { stateCodeFromName } = require('../utils/indianStates');
const { isValidGstinFormat } = require('../utils/gstin');
const { computeCouponDiscount, couponUnusableReason } = require('../utils/coupon');
const { resolveQuotedShipping } = require('../utils/shippingQuote');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, PLATFORM_GST_STATE_CODE } = require('../config/env');
const { sendOrderConfirmation, sendVendorNewOrderEmail, sendAdminNewOrderEmail, sendShippingUpdate, sendAdminOrderCancelledEmail } = require('../services/emailService');
const notif = require('../utils/notificationHelper');
const whatsapp = require('../services/whatsappService');
const { createVendorCommissions, createAffiliateCommission } = require('../services/commissionService');
const { ensureInvoiceForOrder } = require('../services/invoiceBuilder');
const { reserveStock, releaseStock } = require('../services/inventoryService');
const { applyEarnings } = require('../utils/earningsHelper');

const razorpay = RAZORPAY_KEY_ID
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

/**
 * Normalises the optional B2B billing block sent by checkout.
 *
 * Returns undefined when nothing usable was supplied, so B2C orders store no
 * `billing` sub-document at all and behave exactly as before.
 *
 * @throws {AppError} when a GSTIN is supplied but malformed
 */
function buildBillingSnapshot(input) {
  if (!input || typeof input !== 'object') return undefined;

  const gstin = String(input.gstin || '').trim().toUpperCase();
  const companyName = String(input.companyName || '').trim();
  const poNumber = String(input.poNumber || '').trim();

  if (gstin && !isValidGstinFormat(gstin)) {
    throw new AppError('Enter a valid 15-character GSTIN (e.g. 33AAACM1234C1ZP)', 400, 'INVALID_GSTIN');
  }
  if (!gstin && !companyName && !poNumber) return undefined;

  return {
    ...(companyName && { companyName }),
    ...(gstin && { gstin }),
    ...(poNumber && { poNumber }),
  };
}

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

    // Optional B2B billing details. Format is checked here and nowhere else —
    // no GSTN lookup — and the result is snapshotted onto the order so a later
    // profile edit can never alter an issued invoice.
    const billing = buildBillingSnapshot(req.body.billing);

    // Resolves the user's cart, folding in any guest cart from this browser session.
    const cart = await resolveCart(req);
    if (cart) await cart.populate('items.product');
    if (!cart?.items?.length) throw new AppError('Cart is empty', 400, 'EMPTY_CART');

    // Fetch vendor profiles once for commission rate lookup
    const User = require('../models/User');
    const uniqueVendorIds = [...new Set(cart.items.map((i) => i.product?.vendorId?.toString()).filter(Boolean))];
    const vendors = await User.find({ _id: { $in: uniqueVendorIds } }).select('vendorProfile');
    const vendorMap = Object.fromEntries(vendors.map((v) => [v._id.toString(), v]));

    // Validate stock and build order items
    // Place of supply for goods is the delivery state. `shippingAddress.state` is
    // free text, so it may not resolve — in that case the components below are
    // left unset rather than guessed.
    const placeOfSupplyStateCode = stateCodeFromName(shippingAddress.state);

    const items = [];
    for (const item of cart.items) {
      const product = item.product;
      if (!product || !product.published) throw new AppError(`${item.title} is no longer available`, 400, 'PRODUCT_UNAVAILABLE');

      // A variant line is stocked on the variant, not the parent. Checking the
      // parent here would reject every variant product whose parent stock is 0,
      // which is the normal way variant products are set up.
      const variant = item.variantId ? product.variants?.id?.(item.variantId) : null;
      if (item.variantId && !variant) {
        throw new AppError(`${item.title} is no longer available`, 400, 'PRODUCT_UNAVAILABLE');
      }
      const availableStock = variant ? variant.stock : product.stock;
      if (availableStock < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.title}`, 400, 'OUT_OF_STOCK');
      }

      // The price the customer was actually shown. Cart, checkout summary and the
      // order must agree, so this comes from the cart snapshot rather than being
      // re-read from the product: for a variant line the parent price is simply
      // the wrong number, and for any line a catalogue edit mid-session would
      // charge an amount the customer never saw. Falls back only if a legacy cart
      // row somehow lacks it.
      const unitPrice = Number.isFinite(item.price)
        ? item.price
        : (variant?.price ?? product.price);

      const itemTotal = unitPrice * item.quantity;
      const platformRate = vendorMap[product.vendorId?.toString()]?.vendorProfile?.commissionRate ?? 10;

      const gstRate = resolveTaxRate(product);
      const supplierStateCode = resolveSupplierStateCode(
        vendorMap[product.vendorId?.toString()],
        PLATFORM_GST_STATE_CODE,
      );
      // Components are additive: gstRate and the order-level gstAmount below are
      // unchanged, so nothing downstream that reads them is affected.
      const tax = splitGst({ lineTotal: itemTotal, rate: gstRate, supplierStateCode, placeOfSupplyStateCode });

      // Commission is charged on the taxable value, not the GST-inclusive price.
      // Same helper as commissionService, so the two can never disagree.
      const { platformFee, vendorEarning } = computeCommission(
        { price: unitPrice, quantity: item.quantity, gstRate, taxableValue: tax.taxableValue },
        platformRate,
      );

      items.push({
        product: product._id,
        // Carried through so inventory can reserve and release the right variant,
        // and so cancellation restores what was actually taken.
        variantId: item.variantId || null,
        title: product.title,
        sku: product.sku,
        price: unitPrice,
        quantity: item.quantity,
        gstRate,
        image: product.images?.[0],
        vendorId: product.vendorId,
        platformFee,
        vendorEarning,
        // Immutable snapshot: the invoice must show the HSN that applied when the
        // order was placed, even if the product is later edited or deleted.
        hsnCode: product.hsnCode?.trim() || undefined,
        taxableValue: tax.taxableValue,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
      });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    // GST is inclusive in price: gstAmount = price * qty * rate / (100 + rate)
    const gstAmount = parseFloat(
      items.reduce((sum, i) => sum + (i.price * i.quantity * i.gstRate) / (100 + i.gstRate), 0).toFixed(2)
    );
    // Recompute the coupon against THIS subtotal. The value cached on the cart was
    // calculated when the coupon was applied; if items were removed afterwards it
    // can exceed the basket, which previously produced ₹0 orders.
    let discount = 0;
    if (cart.coupon?.code) {
      const coupon = await Coupon.findOne({ code: cart.coupon.code, active: true });
      const unusable = couponUnusableReason(coupon, subtotal);
      if (unusable) {
        console.warn(`[order] coupon ${cart.coupon.code} no longer valid at checkout (${unusable})`);
      } else {
        discount = computeCouponDiscount(coupon, subtotal);
      }
    }

    const [freeThreshold, defaultRate] = await Promise.all([
      Setting.get('shipping.free_threshold', 5000),
      Setting.get('shipping.default_rate', 70),
    ]);
    const serverShipping = subtotal >= parseFloat(freeThreshold) ? 0 : parseFloat(defaultRate);
    // The client tells us which option was picked; it does not get to invent the
    // price. Accept the figure only if it matches a rate this server actually
    // quoted for this pincode, otherwise fall back to the configured default.
    const shippingCharge = subtotal >= parseFloat(freeThreshold)
      ? 0
      : await resolveQuotedShipping(shippingAddress.pincode, req.body.shippingCharge, serverShipping);

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
      billing,
      placeOfSupplyStateCode,
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

    // Take stock. All-or-nothing — reserveStock rolls back its own partial
    // decrements, so a failure on one line cannot strand the others.
    try {
      await reserveStock(items);
      await Order.findByIdAndUpdate(order._id, { inventoryApplied: true });
    } catch (stockErr) {
      await Order.findByIdAndDelete(order._id);
      throw stockErr;
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
      // Issue the tax invoice. Idempotent, and the download route will issue it
      // lazily if this fails, so a transient error never blocks payment.
      ensureInvoiceForOrder(order).catch((e) =>
        console.error(`[invoice] issue failed for ${order.orderId}:`, e.message));

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

    // Reverse the money before mutating the status — applyEarnings compares the
    // previous status to the new one. This is the only cancellation path that
    // was not already routed through it, so commission rows created at payment
    // were left payable. Earnings are untouched here: this route only allows
    // pre-delivery statuses, so nothing was ever credited.
    await applyEarnings(order, 'cancelled').catch((e) =>
      console.error(`[cancelOrder] reversal failed for ${order.orderId}:`, e.message));

    order.status = 'cancelled';
    order.cancellation = { reason: 'Cancelled by customer', cancelledAt: new Date(), cancelledBy: req.user._id };
    await order.save();

    // Restore stock
    await releaseStock(order.items);

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
