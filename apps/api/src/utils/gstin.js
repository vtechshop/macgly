/**
 * Pure GSTIN / Indian financial-year helpers.
 *
 * Format only — no checksum validation and no GSTN lookup. Those belong to a
 * verification service, not here.
 */

// 2-digit state code, 5 letters (PAN), 4 digits, 1 letter, 1 entity digit/letter,
// literal 'Z', 1 checksum char.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Structural check only. A `true` here does not mean the GSTIN is registered. */
function isValidGstinFormat(gstin) {
  return typeof gstin === 'string' && GSTIN_RE.test(gstin.trim().toUpperCase());
}

/** First two characters of a GSTIN are the state code (e.g. '33' = Tamil Nadu). */
function stateCodeFromGstin(gstin) {
  if (!isValidGstinFormat(gstin)) return null;
  return gstin.trim().toUpperCase().slice(0, 2);
}

// Invoice series roll over on the Indian financial year, which starts 1 April
// *in IST*. Computing this in UTC would put orders placed between 00:00 and
// 05:30 IST on 1 April into the previous year's series.
const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * Indian financial year label for a date, e.g. 2026-06-01 -> '2026-27'.
 * @param {Date} [date]
 * @returns {string}
 */
function financialYear(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() >= 3 ? year : year - 1; // month 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

module.exports = { isValidGstinFormat, stateCodeFromGstin, financialYear, GSTIN_RE };
