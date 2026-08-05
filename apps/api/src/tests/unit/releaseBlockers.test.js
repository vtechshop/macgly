/**
 * Permanent coverage for the RC-02 release blockers. Pure helpers only — no DB.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const { computeCouponDiscount, couponUnusableReason } = require('../../utils/coupon');
const { rememberQuote, resolveQuotedShipping } = require('../../utils/shippingQuote');
const { isValidWebhookSignature } = require('../../utils/razorpaySignature');
const { resolveReturnLines } = require('../../utils/returnLines');

describe('SEC-03 — coupon discount is bounded by the subtotal', () => {
  const flat = (value, over = {}) => ({ type: 'flat', value, active: true, usedCount: 0, usageLimit: 0, minOrderAmount: 0, ...over });

  it('caps a flat coupon at the basket value', () => {
    // The exploit: apply ₹5000 to a big cart, strip it down, check out for ₹0.
    expect(computeCouponDiscount(flat(5000), 4900)).toBe(4900);
    expect(Math.max(0, 4900 - computeCouponDiscount(flat(5000), 4900))).toBe(0);
  });

  it('leaves a legitimate discount alone', () => {
    expect(computeCouponDiscount(flat(5000), 50000)).toBe(5000);
  });

  it.each([
    [{ type: 'percent', value: 10 }, 2500, 250],
    [{ type: 'percent', value: 10, maxDiscount: 100 }, 2500, 100],
    [{ type: 'percent', value: 200 }, 1000, 1000],   // capped at the subtotal
    [{ type: 'flat', value: -999 }, 1000, 0],        // never negative
  ])('%o on %s -> %s', (coupon, subtotal, expected) => {
    expect(computeCouponDiscount(coupon, subtotal)).toBe(expected);
  });

  it.each([
    ['zero subtotal', flat(500), 0],
    ['null coupon', null, 1000],
    ['undefined coupon', undefined, 1000],
  ])('returns 0 for %s', (_l, coupon, subtotal) => {
    expect(computeCouponDiscount(coupon, subtotal)).toBe(0);
  });

  it.each([
    ['inactive', { active: false }, 'INVALID_COUPON'],
    ['expired', { expiry: new Date('2020-01-01') }, 'COUPON_EXPIRED'],
    ['exhausted', { usageLimit: 1, usedCount: 1 }, 'COUPON_LIMIT_REACHED'],
    ['below minimum', { minOrderAmount: 99999 }, 'MIN_ORDER_NOT_MET'],
  ])('rejects %s', (_l, over, code) => {
    expect(couponUnusableReason(flat(100, over), 1000)).toBe(code);
  });

  it('accepts a usable coupon', () => {
    expect(couponUnusableReason(flat(100), 1000)).toBeNull();
  });
});

describe('SEC-04 — shipping must match a rate we quoted', () => {
  beforeAll(async () => { await rememberQuote('641006', [{ charge: 70 }, { charge: 120 }]); });

  it('refuses a client-invented zero', async () => {
    expect(await resolveQuotedShipping('641006', 0, 70)).toBe(70);
  });

  it.each([70, 120])('accepts the quoted rate %s', async (c) => {
    expect(await resolveQuotedShipping('641006', c, 70)).toBe(c);
  });

  it.each([5, -50, 'free', null, undefined, NaN, {}])('refuses %p', async (c) => {
    expect(await resolveQuotedShipping('641006', c, 70)).toBe(70);
  });

  it('falls back to the default when nothing was quoted for the pincode', async () => {
    expect(await resolveQuotedShipping('999999', 120, 70)).toBe(70);
  });

  it('does not let one pincode borrow another pincode\'s rate', async () => {
    await rememberQuote('110001', [{ charge: 243 }]);
    expect(await resolveQuotedShipping('110001', 243, 70)).toBe(243);
    expect(await resolveQuotedShipping('641006', 243, 70)).toBe(70);
  });

  it('ignores a malformed pincode rather than caching junk', async () => {
    await expect(rememberQuote('abc', [{ charge: 1 }])).resolves.toBeUndefined();
  });
});

describe('SEC-05 — webhook signature', () => {
  const SECRET = 'whsec_test';
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
  const sign = (b, s) => crypto.createHmac('sha256', s).update(b).digest('hex');

  it('accepts a genuine signature', () => {
    expect(isValidWebhookSignature(body, sign(body, SECRET), SECRET)).toBe(true);
  });

  it('rejects the API key secret — the fallback that broke every webhook', () => {
    expect(isValidWebhookSignature(body, sign(body, SECRET), 'rzp_key_secret')).toBe(false);
  });

  it('rejects a tampered body', () => {
    expect(isValidWebhookSignature(Buffer.from('{"event":"x"}'), sign(body, SECRET), SECRET)).toBe(false);
  });

  it('rejects a re-serialised body — key order changes the bytes', () => {
    const reordered = Buffer.from(JSON.stringify({ payload: {}, event: 'payment.captured' }));
    expect(isValidWebhookSignature(reordered, sign(body, SECRET), SECRET)).toBe(false);
  });

  it.each(['', 'zz', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), null, undefined, 12345, {}])(
    'rejects malformed signature %p without throwing', (sig) => {
      expect(() => isValidWebhookSignature(body, sig, SECRET)).not.toThrow();
      expect(isValidWebhookSignature(body, sig, SECRET)).toBe(false);
    });

  it.each([['secret', ''], ['body', null]])('rejects a missing %s', (_l) => {
    expect(isValidWebhookSignature(null, sign(body, SECRET), '')).toBe(false);
  });
});

describe('RET-01 — refund reflects what was returned', () => {
  const pid1 = new mongoose.Types.ObjectId();
  const pid2 = new mongoose.Types.ObjectId();
  const variant = new mongoose.Types.ObjectId();
  const order = {
    totalAmount: 50070,
    items: [
      { product: pid1, variantId: null, title: 'Lathe', price: 50000, quantity: 1 },
      { product: pid2, variantId: variant, title: 'Blade', price: 100, quantity: 2 },
    ],
  };

  it('refunds one ₹100 item as ₹100, not the ₹50,070 order total', () => {
    const r = resolveReturnLines(order, [{ product: pid2, variantId: variant, quantity: 1 }]);
    expect(r.refundAmount).toBe(100);
    expect(r.isFullReturn).toBe(false);
  });

  it('carries the variant through so stock returns to the right place', () => {
    const r = resolveReturnLines(order, [{ product: pid2, variantId: variant, quantity: 1 }]);
    expect(String(r.returnItems[0].variantId)).toBe(String(variant));
  });

  it('treats no items as a full return', () => {
    for (const items of [undefined, null, []]) {
      const r = resolveReturnLines(order, items);
      expect(r.refundAmount).toBe(50070);
      expect(r.isFullReturn).toBe(true);
    }
  });

  it('treats every line at full quantity as a full return, refunding shipping too', () => {
    const r = resolveReturnLines(order, [
      { product: pid1, quantity: 1 },
      { product: pid2, variantId: variant, quantity: 2 },
    ]);
    expect(r.refundAmount).toBe(50070);
    expect(r.isFullReturn).toBe(true);
  });

  it('clamps quantity to what was bought', () => {
    expect(resolveReturnLines(order, [{ product: pid2, variantId: variant, quantity: 99 }]).refundAmount).toBe(200);
  });

  it('prices from the order, never from the request', () => {
    const r = resolveReturnLines(order, [{ product: pid2, variantId: variant, quantity: 1, price: 999999 }]);
    expect(r.refundAmount).toBe(100);
  });

  it('ignores a product that is not on the order', () => {
    const r = resolveReturnLines(order, [{ product: new mongoose.Types.ObjectId(), quantity: 1 }]);
    expect(r.isFullReturn).toBe(true);
  });

  it('does not double-count a duplicated line', () => {
    const r = resolveReturnLines(order, [
      { product: pid2, variantId: variant, quantity: 1 },
      { product: pid2, variantId: variant, quantity: 1 },
    ]);
    expect(r.refundAmount).toBe(100);
  });

  it('does not match the wrong variant of the same product', () => {
    const r = resolveReturnLines(order, [{ product: pid2, variantId: null, quantity: 1 }]);
    expect(r.isFullReturn).toBe(true);
  });

  it('survives a malformed order', () => {
    expect(resolveReturnLines({}, []).refundAmount).toBe(0);
    expect(resolveReturnLines(null, null).refundAmount).toBe(0);
  });
});
