// Mirrors apps/api/src/utils/gstin.js. Client-side check is for feedback only —
// the server validates authoritatively in orderController.buildBillingSnapshot.

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Structural check only. No GSTN lookup — a `true` here does not mean it is registered. */
export function isValidGstinFormat(gstin) {
  return typeof gstin === 'string' && GSTIN_RE.test(gstin.trim().toUpperCase());
}
