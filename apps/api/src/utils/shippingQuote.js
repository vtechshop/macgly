const { getCache, setCache } = require('./cache');

/**
 * Remembers what this server quoted for a pincode, so checkout can tell a real
 * shipping charge from an invented one.
 *
 * Checkout previously took `req.body.shippingCharge` at face value, so any
 * client could post `0`. Rather than re-calling the carrier on the order path
 * (latency plus an external dependency at the worst moment), the rates endpoint
 * records what it quoted and checkout validates against that.
 *
 * A miss is not a failure: checkout falls back to the configured default rate,
 * which is never client-controlled.
 */

const QUOTE_TTL_SECONDS = 60 * 60; // an hour — comfortably longer than a checkout
const key = (pincode) => `shipquote:${pincode}`;

/** Called by GET /catalog/shipping-rates after it computes the options. */
async function rememberQuote(pincode, options) {
  if (!/^\d{6}$/.test(String(pincode || ''))) return;
  const charges = (options || [])
    .map((o) => Number(o.charge))
    .filter((c) => Number.isFinite(c) && c >= 0);
  if (!charges.length) return;
  await setCache(key(pincode), charges, QUOTE_TTL_SECONDS).catch(() => {});
}

/**
 * Returns the charge to bill: the client's figure when it matches something we
 * quoted for this pincode, otherwise the server default.
 *
 * @param {string} pincode
 * @param {*} claimed        raw `req.body.shippingCharge`
 * @param {number} fallback  server-configured default rate
 * @returns {Promise<number>}
 */
async function resolveQuotedShipping(pincode, claimed, fallback) {
  const wanted = Number(claimed);
  if (!Number.isFinite(wanted) || wanted < 0) return fallback;

  let quoted = null;
  try { quoted = await getCache(key(pincode)); } catch { /* cache down — fall back */ }

  if (Array.isArray(quoted) && quoted.some((c) => Math.abs(c - wanted) < 0.01)) {
    return wanted;
  }

  if (Math.abs(wanted - fallback) < 0.01) return fallback;

  console.warn(`[shipping] unquoted charge ₹${wanted} for pincode ${pincode}; billing default ₹${fallback}`);
  return fallback;
}

module.exports = { rememberQuote, resolveQuotedShipping, QUOTE_TTL_SECONDS };
