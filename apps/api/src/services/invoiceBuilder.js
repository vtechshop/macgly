const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { allocateInvoiceNumber } = require('./invoiceNumberService');
const { PLATFORM_PARTY } = require('../config/platform');
const { stateCodeFromGstin } = require('../utils/gstin');
const { stateCodeFromName, canonicalStateCode } = require('../utils/indianStates');

/**
 * Builds the immutable Invoice record for a paid order.
 *
 * Everything on the invoice is a snapshot taken once, at issue time. Nothing
 * here reads Product — line data comes from `order.items`, which already carries
 * hsnCode, gstRate, taxableValue and the CGST/SGST/IGST split (PAY-01/02,
 * GST-HSN-01). The supplier's legal identity is read from User once and copied
 * in; rendering never joins anything afterwards.
 */

const KIND = 'vendor_tax_invoice';
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Which legal person is supplying this order.
 *
 * One distinct vendor      -> that vendor.
 * No vendor (admin stock)  -> the platform.
 * More than one vendor     -> the platform, matching today's single-document
 *                             behaviour. Splitting a mixed basket into one
 *                             invoice per supplier is a legal/accounting call
 *                             (principal vs agent), not an engineering one.
 */
function resolveSupplierRef(order) {
  const vendorIds = [...new Set(
    (order.items || []).map((i) => i.vendorId?.toString()).filter(Boolean),
  )];
  if (vendorIds.length === 1) return { vendorId: vendorIds[0], mixed: false };
  return { vendorId: null, mixed: vendorIds.length > 1 };
}

function platformParty() {
  return { ...PLATFORM_PARTY, stateCode: canonicalStateCode(PLATFORM_PARTY.stateCode) };
}

function vendorParty(vendor) {
  const vp = vendor.vendorProfile || {};
  return {
    userId:    vendor._id,
    legalName: vp.businessName || vp.storeName || vendor.name || 'Vendor',
    tradeName: vp.storeName || vp.businessName || vendor.name || '',
    gstin:     vp.gstin || '',
    pan:       vp.panCard || '',
    stateCode: canonicalStateCode(stateCodeFromGstin(vp.gstin)),
    email:     vendor.email || '',
    phone:     vp.businessPhone || vendor.phone || '',
    address:   { line1: vp.businessAddress || '', country: 'India' },
  };
}

function recipientParty(order, buyer) {
  const addr = order.shippingAddress || {};
  const billing = order.billing || {};
  return {
    userId:    order.user || undefined,
    legalName: billing.companyName || buyer?.name || order.customerName || addr.name || 'Customer',
    gstin:     billing.gstin || '',
    stateCode: canonicalStateCode(stateCodeFromName(addr.state)),
    email:     buyer?.email || '',
    phone:     buyer?.phone || order.customerPhone || addr.phone || '',
    address: {
      line1: addr.line1, line2: addr.line2, city: addr.city,
      state: addr.state, pincode: addr.pincode, country: addr.country || 'India',
    },
  };
}

/** Order item -> invoice line. Snapshot in, snapshot out. */
function toLine(item) {
  const grossAmount = round2((item.price || 0) * (item.quantity || 0));
  const taxes = [];
  if (item.cgst) taxes.push({ component: 'CGST', rate: (item.gstRate || 0) / 2, taxableValue: item.taxableValue ?? 0, amount: item.cgst });
  if (item.sgst) taxes.push({ component: 'SGST', rate: (item.gstRate || 0) / 2, taxableValue: item.taxableValue ?? 0, amount: item.sgst });
  if (item.igst) taxes.push({ component: 'IGST', rate: item.gstRate || 0, taxableValue: item.taxableValue ?? 0, amount: item.igst });

  return {
    product:      item.product,
    vendorId:     item.vendorId,
    title:        item.title,
    sku:          item.sku,
    hsnCode:      item.hsnCode,
    unit:         item.unit || 'NOS',
    quantity:     item.quantity,
    unitPrice:    item.price,
    grossAmount,
    discount:     0,
    taxableValue: item.taxableValue,
    taxes,
    totalAmount:  grossAmount,
  };
}

function totalsFrom(lines, order) {
  const sum = (fn) => round2(lines.reduce((s, l) => s + fn(l), 0));
  const comp = (name) => sum((l) => (l.taxes.find((t) => t.component === name)?.amount) || 0);
  return {
    taxableValue: sum((l) => l.taxableValue || 0),
    cgst: comp('CGST'),
    sgst: comp('SGST'),
    igst: comp('IGST'),
    cess: 0,
    shipping: order.shippingCharge || 0,
    discount: order.discount || 0,
    roundOff: 0,
    grandTotal: order.totalAmount || 0,
  };
}

/**
 * Creates the tax invoice for an order, or returns the one that already exists.
 *
 * Idempotent: safe to call from payment verification, the Razorpay webhook and
 * the download route. A unique partial index on `order` is the backstop if two
 * callers race — the loser reads the winner's document.
 *
 * @param {object} order a paid Order document
 * @returns {Promise<object|null>} the Invoice, or null if one cannot be issued
 */
async function ensureInvoiceForOrder(order) {
  if (!order?._id) return null;
  if (order.paymentStatus !== 'paid') return null; // only paid orders get a tax invoice

  const existing = await Invoice.findOne({ order: order._id, kind: KIND });
  if (existing) return existing;

  const { vendorId, mixed } = resolveSupplierRef(order);
  const [vendor, buyer] = await Promise.all([
    vendorId ? User.findById(vendorId).select('name email phone vendorProfile') : null,
    order.user ? User.findById(order.user).select('name email phone') : null,
  ]);

  const supplier = vendor ? vendorParty(vendor) : platformParty();
  const recipient = recipientParty(order, buyer);
  const lines = (order.items || []).map(toLine);

  const issueDate = new Date();
  const allocation = await allocateInvoiceNumber({
    kind: KIND,
    owner: vendor?._id || null,
    date: issueDate,
  });

  try {
    const invoice = await Invoice.create({
      kind: KIND,
      status: 'issued',
      number: allocation.number,
      series: allocation.seriesId,
      financialYear: allocation.financialYear,
      sequence: allocation.sequence,
      issueDate,
      supplier,
      recipient,
      placeOfSupplyStateCode: order.placeOfSupplyStateCode
        || canonicalStateCode(stateCodeFromName(order.shippingAddress?.state)),
      reverseCharge: false,
      order: order._id,
      orderNumber: order.orderId,
      lines,
      totals: totalsFrom(lines, order),
      currency: 'INR',
      meta: mixed ? { multiSupplierOrder: true } : undefined,
    });

    console.log(`[invoice] issued ${invoice.number} for order ${order.orderId}${mixed ? ' (multi-supplier)' : ''}`);
    return invoice;
  } catch (err) {
    if (err.code === 11000) {
      // Lost the race. The allocated number is burned — a gap in the series is
      // preferable to the same number appearing on two documents.
      console.warn(`[invoice] concurrent issue for order ${order.orderId}; number ${allocation.number} skipped`);
      return Invoice.findOne({ order: order._id, kind: KIND });
    }
    throw err;
  }
}

module.exports = { ensureInvoiceForOrder };
