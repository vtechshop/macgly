const AppError = require('./AppError');

/**
 * Server-side pricing rules for manual (in-store / phone) orders.
 *
 * Both manual-order UIs deliberately expose an editable price so a counter
 * operator can honour a negotiated discount, and that workflow is preserved.
 * What is NOT preserved is the client deciding what the platform earns: the
 * catalogue price is fetched server-side and the commission is billed against
 * it, so a declared price only ever changes the customer's receipt.
 *
 * Every override is recorded on the order line as `listPrice`, so a discount is
 * auditable rather than silent.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Absorbs float noise when comparing a client-computed total to ours.
const TOTAL_TOLERANCE = 0.01;

/**
 * Reconciles a client-declared unit price against the catalogue.
 *
 * @param {*} declared    raw `item.price` from the request; may be absent
 * @param {{price:number}} product the catalogue product, read server-side
 * @param {string} title  for error messages
 * @returns {{sellingPrice:number, listPrice:number}}
 */
function resolveManualPrice(declared, product, title) {
  const listPrice = round2(Number(product?.price) || 0);

  // Absent or blank means "use the catalogue price" — the common case.
  if (declared === undefined || declared === null || declared === '') {
    return { sellingPrice: listPrice, listPrice };
  }

  // Only a number or a numeric string is meaningful here. Without the typeof
  // guard, Number([]) === 0 would turn a malformed payload into a free item.
  if (typeof declared !== 'number' && typeof declared !== 'string') {
    throw new AppError(`Invalid price for ${title}`, 400, 'INVALID_PRICE');
  }
  const sellingPrice = Number(declared);
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new AppError(`Invalid price for ${title}`, 400, 'INVALID_PRICE');
  }
  return { sellingPrice: round2(sellingPrice), listPrice };
}

/**
 * Rejects a discount so deep that the platform fee exceeds the sale.
 *
 * Without this the line would carry a negative `vendorEarning`, which breaks
 * payouts and reporting. A legitimate discount never approaches this — at a 10%
 * commission the sale price has to fall below about a tenth of list.
 */
function assertFeeCoveredBySale({ platformFee, vendorEarning, title, sellingPrice, listPrice }) {
  if (vendorEarning >= 0) return;
  throw new AppError(
    `Price for ${title} is too low: the platform fee of ₹${platformFee.toFixed(2)} ` +
    `(charged on the catalogue price of ₹${listPrice.toFixed(2)}) exceeds the sale value of ` +
    `₹${sellingPrice.toFixed(2)}. Reduce the discount or update the catalogue price.`,
    400,
    'PRICE_BELOW_COMMISSION',
  );
}

/** Keeps an order-level discount inside a sane range. */
function clampDiscount(raw, subtotal) {
  const discount = Number(raw);
  if (!Number.isFinite(discount) || discount <= 0) return 0;
  return round2(Math.min(discount, subtotal));
}

/**
 * `amountPaid` is informational — the total is always derived. Accepting a value
 * above the derived total would let the client inflate what the books record.
 */
function assertAmountPaidMatches(amountPaid, totalAmount) {
  if (amountPaid === undefined || amountPaid === null || amountPaid === '') return;
  const claimed = Number(amountPaid);
  if (!Number.isFinite(claimed) || claimed < 0) {
    throw new AppError('Invalid amount paid', 400, 'INVALID_AMOUNT');
  }
  if (claimed - totalAmount > TOTAL_TOLERANCE) {
    throw new AppError(
      `Amount paid (₹${claimed.toFixed(2)}) exceeds the order total of ₹${totalAmount.toFixed(2)}.`,
      400,
      'AMOUNT_MISMATCH',
    );
  }
}

module.exports = {
  resolveManualPrice,
  assertFeeCoveredBySale,
  clampDiscount,
  assertAmountPaidMatches,
  round2,
};
