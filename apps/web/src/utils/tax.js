// Mirrors apps/api/src/utils/tax.js. Keep the two in sync — if they diverge,
// the GST shown in the cart stops matching the GST stored on the order.

export const FALLBACK_TAX_RATE = 18;

/**
 * GST rate for a cart line's product, in percent.
 * `taxRate` defaults to 0 in the schema and cannot be told apart from "unset",
 * so 0 falls back to 18 exactly as the server does.
 */
export function resolveTaxRate(product) {
  const rate = Number(product?.taxRate);
  return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_TAX_RATE;
}

/** GST contained in a GST-inclusive line total. */
export function inclusiveGstAmount(lineTotal, rate) {
  return (lineTotal * rate) / (100 + rate);
}
