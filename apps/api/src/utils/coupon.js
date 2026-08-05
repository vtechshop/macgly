/**
 * Coupon discount rules, in one place.
 *
 * Used both when a coupon is applied to the cart and again when the order is
 * created. The value stored on the cart is a display convenience only — the
 * order must recompute against its own subtotal, or removing items after
 * applying a coupon leaves a discount larger than the basket.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param {{type:'flat'|'percent', value:number, maxDiscount?:number}} coupon
 * @param {number} subtotal
 * @returns {number} discount, never negative and never more than the subtotal
 */
function computeCouponDiscount(coupon, subtotal) {
  const base = Number(subtotal) || 0;
  if (!coupon || base <= 0) return 0;

  const value = Number(coupon.value) || 0;
  let discount = coupon.type === 'flat'
    ? value
    : (base * value) / 100;

  if (coupon.type !== 'flat' && coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }

  return round2(Math.min(Math.max(discount, 0), base));
}

/**
 * Whether a coupon may still be used, ignoring per-user limits.
 * @returns {string|null} a reason code when unusable, null when fine
 */
function couponUnusableReason(coupon, subtotal, now = new Date()) {
  if (!coupon || !coupon.active) return 'INVALID_COUPON';
  if (coupon.expiry && coupon.expiry < now) return 'COUPON_EXPIRED';
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return 'COUPON_LIMIT_REACHED';
  if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) return 'MIN_ORDER_NOT_MET';
  return null;
}

module.exports = { computeCouponDiscount, couponUnusableReason };
