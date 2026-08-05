const crypto = require('crypto');

// Razorpay signs with HMAC-SHA256, so a valid signature is always 64 hex chars.
const SHA256_HEX = /^[0-9a-fA-F]{64}$/;

/**
 * Verifies the `order_id|payment_id` signature returned by Razorpay Checkout.
 *
 * Uses a constant-time comparison. The Razorpay SDK's own
 * `validatePaymentVerification` compares with `===`, which leaks timing
 * information, so we do not use it.
 *
 * @returns {boolean} true only when the signature is authentic
 */
function isValidPaymentSignature({ orderId, paymentId, signature, secret }) {
  if (!orderId || !paymentId || !secret) return false;
  if (typeof signature !== 'string' || !SHA256_HEX.test(signature)) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Both sides are guaranteed 32-byte buffers here, so timingSafeEqual cannot throw.
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.toLowerCase(), 'hex'),
  );
}

/**
 * Verifies the `X-Razorpay-Signature` header on a webhook.
 *
 * Signed over the RAW request body — re-serialising `req.body` will not match,
 * because key order and formatting differ. Must be given the buffer captured by
 * the `verify` hook in app.js.
 *
 * Uses the WEBHOOK secret, which is a different value from the API key secret.
 * There is deliberately no fallback between them: signing with the wrong secret
 * fails every webhook silently, which is worse than refusing to start.
 *
 * @returns {boolean}
 */
function isValidWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !secret) return false;
  if (typeof signature !== 'string' || !SHA256_HEX.test(signature)) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.toLowerCase(), 'hex'),
  );
}

module.exports = { isValidPaymentSignature, isValidWebhookSignature };
