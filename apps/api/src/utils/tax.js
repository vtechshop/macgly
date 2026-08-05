// Product tax rate is stored on `Product.taxRate` (percent). `Product.gstRate`
// has never existed — reading it always yielded undefined, which is why every
// order line was previously stamped with the 18% fallback. See AUDIT PAY-01.

const { stateCodeFromGstin } = require('./gstin');
const { canonicalStateCode } = require('./indianStates');

const FALLBACK_TAX_RATE = 18;

/**
 * Resolves the GST rate to stamp on an order line.
 *
 * `taxRate` defaults to 0 in the Product schema, so 0 cannot be distinguished
 * from "never configured". Treating 0 as nil-rated would silently stop
 * collecting tax on every product an admin has not explicitly configured, so 0
 * keeps the existing 18% fallback. Genuinely exempt goods need an explicit
 * decision (the unused `Product.taxable` flag) — that is a data question, not
 * this fix.
 *
 * @param {{ taxRate?: number }} product
 * @returns {number} percent, e.g. 5 / 12 / 18 / 28
 */
function resolveTaxRate(product) {
  const rate = Number(product?.taxRate);
  return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_TAX_RATE;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Supplier's GST state code for one order line.
 *
 * Vendor items: derived from the vendor's GSTIN. A vendor with no GSTIN on file
 * yields null — an unregistered supplier has no state of registration, and
 * guessing one would fabricate a tax position.
 * Admin/platform items (`vendorId` empty): the platform's own registration.
 *
 * @returns {string|null}
 */
function resolveSupplierStateCode(vendor, platformStateCode) {
  if (!vendor) return canonicalStateCode(platformStateCode);
  return canonicalStateCode(stateCodeFromGstin(vendor?.vendorProfile?.gstin));
}

/**
 * Splits the GST already contained in a line total into its components.
 *
 * Prices across this system are GST-inclusive (`Product.taxIncluded` is forced
 * true on write), so tax is extracted, never added:
 *     gst = lineTotal * rate / (100 + rate)
 *
 * Same state  -> CGST + SGST, half each.
 * Different   -> IGST, full amount.
 * Either side unknown -> components left undefined. `taxableValue` and the
 * total are still returned, so nothing is lost and no wrong split is recorded.
 *
 * @returns {{taxableValue:number, gstAmount:number, cgst?:number, sgst?:number, igst?:number, interState:boolean|null}}
 */
function splitGst({ lineTotal, rate, supplierStateCode, placeOfSupplyStateCode }) {
  const total = Number(lineTotal) || 0;
  const pct = Number(rate) || 0;
  const gst = round2((total * pct) / (100 + pct));
  const taxableValue = round2(total - gst);

  const supplier = canonicalStateCode(supplierStateCode);
  const pos = canonicalStateCode(placeOfSupplyStateCode);

  if (!supplier || !pos) {
    return { taxableValue, gstAmount: gst, interState: null };
  }

  if (supplier === pos) {
    // cgst is rounded, sgst takes the remainder, so the two always sum to `gst`
    // exactly. That can leave them 1 paise apart — preferred over a split whose
    // total disagrees with the amount actually charged.
    const cgst = round2(gst / 2);
    return { taxableValue, gstAmount: gst, cgst, sgst: round2(gst - cgst), igst: 0, interState: false };
  }

  return { taxableValue, gstAmount: gst, cgst: 0, sgst: 0, igst: gst, interState: true };
}

/**
 * The pre-tax value of an order line — the base platform commission is charged on.
 *
 * Prefers the snapshot written at order time (PAY-02). Orders placed before that
 * existed carry no `taxableValue`, so it is derived from the GST-inclusive line
 * total instead. A rate of 0 means nothing to strip out.
 *
 * @param {{price?:number, quantity?:number, gstRate?:number, taxableValue?:number}} item
 * @returns {number}
 */
function resolveTaxableValue(item) {
  const snapshot = Number(item?.taxableValue);
  if (Number.isFinite(snapshot) && snapshot > 0) return snapshot;

  const lineTotal = (Number(item?.price) || 0) * (Number(item?.quantity) || 0);
  const rate = Number(item?.gstRate) || 0;
  // Subtract the rounded GST rather than dividing directly, so this reproduces
  // exactly what splitGst would have snapshotted. Dividing gives a different
  // paise at some rates (Rs.2500 @ 28%: 1953.13 by division, 1953.12 here).
  const gst = round2((lineTotal * rate) / (100 + rate));
  return round2(lineTotal - gst);
}

/**
 * Platform commission and vendor payout for one order line.
 *
 * The fee is charged on the taxable value, NOT the GST-inclusive price: the GST
 * portion is the government's money passing through the vendor, so the platform
 * has nothing to take a percentage of. The settlement identity is preserved —
 * `platformFee + vendorEarning === lineTotal` — because the customer paid
 * `lineTotal` and that amount must still be fully accounted for.
 *
 * `baseItem` lets the fee be charged against a different line to the one being
 * sold. Manual orders use it to bill against the catalogue price while the
 * receipt shows the discounted price the counter actually charged, so a declared
 * price cannot shrink the commission. Omit it and the fee is charged on the sale
 * itself, which is what every marketplace order does.
 *
 * @param {object} item      the line as sold (price, quantity, gstRate, taxableValue?)
 * @param {number} commissionRate percent
 * @param {{baseItem?: object}} [opts]
 * @returns {{lineTotal:number, taxableValue:number, commissionBase:number, platformFee:number, vendorEarning:number}}
 */
function computeCommission(item, commissionRate, { baseItem } = {}) {
  const lineTotal = round2((Number(item?.price) || 0) * (Number(item?.quantity) || 0));
  const taxableValue = resolveTaxableValue(item);
  const commissionBase = baseItem ? resolveTaxableValue(baseItem) : taxableValue;
  const rate = Number(commissionRate) || 0;
  const platformFee = round2((commissionBase * rate) / 100);
  return {
    lineTotal, taxableValue, commissionBase, platformFee,
    vendorEarning: round2(lineTotal - platformFee),
  };
}

module.exports = {
  resolveTaxRate, resolveSupplierStateCode, splitGst,
  resolveTaxableValue, computeCommission,
  FALLBACK_TAX_RATE,
};
