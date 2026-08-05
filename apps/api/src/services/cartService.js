const Cart = require('../models/Cart');
const { getSessionId } = require('../middleware/session');

/**
 * Cart ownership rules
 * --------------------
 * A cart is owned by exactly one of:
 *   - `user`      — a signed-in customer (unique index)
 *   - `sessionId` — one anonymous browser (unique index)
 *
 * There is no shared/global fallback owner. A request without a valid session
 * and without a user simply has no cart.
 *
 * When a visitor who built a guest cart signs in, that guest cart is merged into
 * their user cart and removed, so the same items are never reachable from two
 * owners at once.
 */

/** Upsert that tolerates a concurrent insert winning the race on the unique index. */
async function upsertCart(filter) {
  try {
    return await Cart.findOneAndUpdate(
      filter,
      { $setOnInsert: { ...filter, items: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    return Cart.findOne(filter);
  }
}

function isSameLine(a, b) {
  return a.product?.toString() === b.product?.toString() &&
    String(a.variantId || '') === String(b.variantId || '');
}

/**
 * Folds the guest cart for `sessionId` into the cart owned by `userId`.
 * Returns the resulting user cart, or null when this session has no guest cart.
 *
 * Concurrency: both branches claim the guest cart with a single atomic write, so
 * two simultaneous requests can never merge the same items twice.
 */
async function mergeGuestCartIntoUser(sessionId, userId) {
  // Fast path — the user has no cart yet, so hand the guest cart over in place.
  // The unique index on `user` arbitrates: it throws 11000 if a user cart exists.
  try {
    const claimed = await Cart.findOneAndUpdate(
      { sessionId, user: { $exists: false } },
      { $set: { user: userId }, $unset: { sessionId: '' } },
      { new: true },
    );
    return claimed || null;
  } catch (err) {
    if (err.code !== 11000) throw err;
    // User already owns a cart — fall through and merge line by line.
  }

  // findOneAndDelete is atomic: only one concurrent request receives the document.
  const guestCart = await Cart.findOneAndDelete({ sessionId });
  const userCart = await Cart.findOne({ user: userId });
  if (!guestCart || !userCart) return userCart || null;

  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find((i) => isSameLine(i, guestItem));
    if (existing) {
      existing.quantity += guestItem.quantity;
    } else {
      const line = guestItem.toObject();
      delete line._id; // let Mongoose mint a fresh subdocument id
      userCart.items.push(line);
    }
  }
  await userCart.save();

  console.log(`[cart] merged guest cart ${guestCart._id} into user ${userId} (${guestCart.items.length} lines)`);
  return userCart;
}

/**
 * Resolves the cart for the current request, merging any guest cart on the way.
 *
 * @param {object}  req
 * @param {boolean} [opts.create] create the cart when none exists (writes only for mutations)
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function resolveCart(req, { create = false } = {}) {
  const sessionId = getSessionId(req);

  if (!req.user) {
    if (!sessionId) return null;
    return create ? upsertCart({ sessionId }) : Cart.findOne({ sessionId });
  }

  // A session issued during this very request cannot have a cart yet — skip the lookup.
  if (sessionId && !req.sessionIsNew) {
    const merged = await mergeGuestCartIntoUser(sessionId, req.user._id);
    if (merged) return merged;
  }

  const userCart = await Cart.findOne({ user: req.user._id });
  if (userCart) return userCart;
  return create ? upsertCart({ user: req.user._id }) : null;
}

module.exports = { resolveCart, mergeGuestCartIntoUser };
