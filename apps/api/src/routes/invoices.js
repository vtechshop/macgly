const router = require('express').Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const { generateInvoiceHTML, generateInvoicePDF } = require('../services/invoiceService');
const { ensureInvoiceForOrder } = require('../services/invoiceBuilder');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

/**
 * Resolves the order for an invoice request and enforces who may see it.
 *
 *   admin    → any order
 *   vendor   → orders containing at least one of their items
 *   customer → their own orders
 *
 * The key may be the human `orderId` ("ORD-…", "VMAN-…") or the Mongo `_id`;
 * different dashboards hold different ones.
 */
async function resolveOrderForInvoice(req, key) {
  const keyMatch = mongoose.Types.ObjectId.isValid(key)
    ? { $or: [{ orderId: key }, { _id: key }] }
    : { orderId: key };

  if (req.user.role === 'admin') {
    return Order.findOne(keyMatch);
  }

  if (req.user.role === 'vendor') {
    const order = await Order.findOne({ ...keyMatch, 'items.vendorId': req.user._id });
    if (!order) return null;

    const mine = order.items.filter((i) => i.vendorId?.toString() === req.user._id.toString());
    // Single-vendor order (always the case for manual orders): the whole
    // document is theirs, so hand it back untouched.
    if (mine.length === order.items.length) return order;

    // Multi-vendor order: never expose another vendor's lines or the buyer's
    // full basket total. Order-level shipping and discount are not attributable
    // to one vendor, so they are left out of this copy.
    const subtotal = mine.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
    const gstAmount = mine.reduce((s, i) => {
      const rate = i.gstRate || 18;
      return s + ((i.price || 0) * (i.quantity || 0) * rate) / (100 + rate);
    }, 0);

    return {
      ...order.toObject(),
      items: mine,
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      shippingCharge: 0,
      discount: 0,
      totalAmount: parseFloat(subtotal.toFixed(2)),
    };
  }

  return Order.findOne({ ...keyMatch, user: req.user._id });
}

// GET /api/invoices/:orderId          → HTML (default, unchanged)
// GET /api/invoices/:orderId?format=pdf → PDF download
router.get('/:orderId', authenticate, async (req, res, next) => {
  try {
    const order = await resolveOrderForInvoice(req, req.params.orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    const user = order.user ? await User.findById(order.user).select('name email phone') : null;

    // Prefer the immutable Invoice record. Orders placed before invoices existed
    // have none and fall back to the legacy Order renderer (PAY-03 req. 8).
    // Vendors on a split order keep the scoped Order view so they still cannot
    // see a rival's lines.
    let source = order;
    if (req.user.role !== 'vendor') {
      const invoice = await Invoice.findOne({ order: order._id, kind: 'vendor_tax_invoice' }).lean()
        || (order.paymentStatus === 'paid'
          ? await ensureInvoiceForOrder(order).catch((e) => {
            console.error(`[invoice] lazy issue failed for ${order.orderId}:`, e.message);
            return null;
          })
          : null);
      if (invoice) source = invoice;
    }

    if (req.query.format === 'pdf') {
      const pdf = await generateInvoicePDF(source, user);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      return res.send(pdf);
    }

    const html = generateInvoiceHTML(source, user);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

module.exports = router;
