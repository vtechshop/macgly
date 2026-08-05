const router = require('express').Router();
const Razorpay = require('razorpay');
const Return = require('../../models/Return');
const Order = require('../../models/Order');
const AppError = require('../../utils/AppError');
const { applyEarnings } = require('../../utils/earningsHelper');
const { releaseStock } = require('../../services/inventoryService');
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

    // Claim the transition first. A return that is already refunded is terminal —
    // without this guard, sending 'refunded' twice issued two Razorpay refunds
    // and restored stock twice.
    const claimed = await Return.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: status }, ...(status === 'refunded' && { refundStatus: { $ne: 'completed' } }) },
      {
        status,
        ...(status === 'refunded' && { refundStatus: 'initiated' }),
        ...(adminNote && { adminNote }),
        ...(['approved', 'rejected', 'refunded'].includes(status) && { resolvedAt: new Date() }),
      },
      { new: false },   // the pre-update document, so we know what it was
    );

    if (!claimed) {
      const current = await Return.findById(req.params.id).select('status refundStatus').lean();
      if (!current) throw new AppError('Return not found', 404, 'NOT_FOUND');
      throw new AppError(
        `Return is already ${current.status}`,
        409,
        'RETURN_ALREADY_PROCESSED',
      );
    }

    const ret = claimed;
    const order = await Order.findById(ret.order);

    // On approved or refunded: reverse vendor/affiliate earnings and mark order returned
    if (['approved', 'refunded'].includes(status) && order && order.status === 'delivered') {
      await applyEarnings(order, 'returned').catch((e) =>
        console.error('[Returns] earnings reversal error:', e.message)
      );
      await Order.findByIdAndUpdate(order._id, { status: 'returned' });
    }

    // On refunded: trigger actual Razorpay refund + restore stock + mark payment refunded.
    // Reached at most once per return — the claim above is the gate.
    if (status === 'refunded' && order) {
      // Refund what the return is worth. An admin override may reduce it but
      // never exceed it; the client does not get to inflate a refund.
      const requested = refundAmount !== undefined ? parseFloat(refundAmount) : NaN;
      const ceiling = ret.refundAmount ?? order.totalAmount ?? 0;
      const amount = Number.isFinite(requested) && requested >= 0
        ? Math.min(requested, ceiling)
        : ceiling;

      // 1. Razorpay refund
      if (RAZORPAY_KEY_ID && order.razorpayPaymentId && amount > 0) {
        try {
          const rz = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
          await rz.payments.refund(order.razorpayPaymentId, { amount: Math.round(amount * 100) });
          console.log(`[Returns] Razorpay refund of ₹${amount} initiated for order ${order.orderId}`);
        } catch (rzpErr) {
          // Log but don't block — admin can retry manually in Razorpay dashboard
          console.error('[Returns] Razorpay refund error:', JSON.stringify(rzpErr?.error || rzpErr));
        }
      }

      // 2. Mark order payment as refunded
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'refunded' });

      // 3. Restore stock through the inventory service so a variant line goes
      //    back to its own variant, not the parent product.
      const itemsToRestore = ret.items?.length ? ret.items : (order.items || []);
      await releaseStock(itemsToRestore).catch((e) =>
        console.error('[Returns] stock restore error:', e.message));

      await Return.findByIdAndUpdate(ret._id, { refundAmount: amount, refundStatus: 'completed' });
    }

    const updatedRet = await Return.findById(req.params.id)
      .populate('user', 'name email')
      .populate('order', 'orderId');

    res.json({ return: updatedRet });
  } catch (err) { next(err); }
});

module.exports = router;
