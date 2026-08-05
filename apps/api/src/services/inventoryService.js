const Product = require('../models/Product');
const AppError = require('../utils/AppError');

/**
 * The one place stock moves.
 *
 * Every caller — marketplace checkout, manual orders, cancellations, the stale
 * order sweeper, the payment-failed webhook — goes through here, so the rules
 * cannot drift apart. Previously each site carried its own `$inc` loop.
 *
 * Simple products and variant products share this path. A line carrying a
 * `variantId` moves `variants[].stock`; everything else moves `Product.stock`.
 *
 * Reservation is atomic per line: the stock check and the `$inc` happen in a
 * single MongoDB update, so two concurrent orders for the last unit cannot both
 * succeed. That guard is also what prevents stock from ever going negative.
 */

/** Accepts order items or plain {product, variantId, quantity} triples; drops anything unusable. */
function normalise(items) {
  return (items || [])
    .map((i) => ({
      product: i.product ?? i.productId,
      variantId: i.variantId ?? null,
      quantity: Number(i.quantity) || 0,
    }))
    .filter((i) => i.product && i.quantity > 0);
}

/**
 * Atomic decrement for one line.
 *
 * The variant filter uses `$elemMatch` deliberately. Expressing it as two dotted
 * conditions (`'variants._id'` and `'variants.stock'`) would let them match two
 * *different* array elements, so a product could pass the check on one variant
 * and be decremented on another. `$elemMatch` forces a single element to satisfy
 * both, and the positional `$` then updates that same element.
 *
 * @returns {Promise<object|null>} the product, or null when stock was insufficient
 */
function decrementOne({ product, variantId, quantity }) {
  if (variantId) {
    return Product.findOneAndUpdate(
      { _id: product, variants: { $elemMatch: { _id: variantId, stock: { $gte: quantity } } } },
      { $inc: { 'variants.$.stock': -quantity } },
    );
  }
  return Product.findOneAndUpdate(
    { _id: product, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
  );
}

function incrementOne({ product, variantId, quantity }) {
  if (variantId) {
    return Product.findOneAndUpdate(
      { _id: product, 'variants._id': variantId },
      { $inc: { 'variants.$.stock': quantity } },
    );
  }
  return Product.findByIdAndUpdate(product, { $inc: { stock: quantity } });
}

/**
 * Puts stock back. Used on cancellation, failed payment and stale-order cleanup.
 * Restores to the same place it was taken from — variant or parent.
 */
async function releaseStock(items) {
  const lines = normalise(items);
  if (!lines.length) return;
  await Promise.all(lines.map(incrementOne));
}

/** Human-readable label for an error message, without assuming the variant still exists. */
async function describeLine({ product, variantId }) {
  const doc = await Product.findById(product).select('title variants').lean();
  if (!doc) return 'one or more items';
  if (!variantId) return doc.title;
  const v = (doc.variants || []).find((x) => String(x._id) === String(variantId));
  return v?.name ? `${doc.title} (${v.name})` : doc.title;
}

/**
 * Takes stock for an order, all-or-nothing.
 *
 * If any line cannot be satisfied, the lines that already succeeded are put
 * back before throwing — without that, a 5-item order failing on item 3 would
 * permanently leak the stock taken for items 1 and 2.
 *
 * @param {Array} items order items or {product, variantId, quantity} triples
 * @throws {AppError} 409 OUT_OF_STOCK naming the product (and variant) that ran short
 */
async function reserveStock(items) {
  const lines = normalise(items);
  if (!lines.length) return;

  const results = await Promise.all(lines.map(decrementOne));

  const failedAt = results.findIndex((r) => r === null);
  if (failedAt === -1) return;

  const applied = lines.filter((_, i) => results[i] !== null);
  if (applied.length) {
    await releaseStock(applied).catch((e) =>
      console.error('[inventory] partial reservation rollback failed:', e.message));
  }

  const label = await describeLine(lines[failedAt]);
  console.warn(`[inventory] reservation refused for ${label}: wanted ${lines[failedAt].quantity}`);
  throw new AppError(`Insufficient stock for ${label}`, 409, 'OUT_OF_STOCK');
}

module.exports = { reserveStock, releaseStock };
