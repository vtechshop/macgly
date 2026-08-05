const InvoiceSeries = require('../models/InvoiceSeries');
const { financialYear } = require('../utils/gstin');

/**
 * Invoice numbering.
 *
 * Numbers must be consecutive and unique per supplier per financial year. The
 * format is stored on the series row so it can be changed per vendor from admin
 * without a deploy — nothing here hardcodes a layout.
 *
 * Placeholders: {PREFIX} {FY} {SEQ}
 */

const DEFAULT_FORMAT = '{PREFIX}/{FY}/{SEQ}';

// Only the fallback used when a series row is created implicitly. Overridable
// per series; not a business rule baked into code.
const DEFAULT_PREFIX = {
  vendor_tax_invoice:  'MGY',
  marketplace_invoice: 'MGYC',
  credit_note:         'MGYCN',
  debit_note:          'MGYDN',
};

/** Pure: renders a series row + sequence into a display number. */
function renderInvoiceNumber(format, { prefix, financialYear: fy, sequence, sequenceWidth = 5 }) {
  return String(format || DEFAULT_FORMAT)
    .replace(/\{PREFIX\}/g, prefix ?? '')
    .replace(/\{FY\}/g, fy ?? '')
    .replace(/\{SEQ\}/g, String(sequence).padStart(sequenceWidth, '0'));
}

/**
 * Atomically reserves the next number in a series, creating the series if needed.
 *
 * The `$inc` is the allocator: MongoDB serialises updates to a single document,
 * so concurrent callers each get a distinct sequence with no gaps and no locks.
 * `nextSequence` has no schema default precisely so `$inc` owns it — the first
 * allocation returns 1.
 *
 * Reserving is not the same as using. If the caller aborts after allocating, the
 * number is burned. That is correct behaviour for tax numbering: a gap you can
 * explain beats a number issued twice.
 *
 * @param {object}   opts
 * @param {string}   opts.kind    one of InvoiceSeries.kind
 * @param {ObjectId} [opts.owner] supplying vendor; null/omitted = platform
 * @param {Date}     [opts.date]  determines the financial year (IST)
 * @param {string}   [opts.prefix] used only when creating the series
 * @returns {Promise<{number, sequence, financialYear, seriesId, format, prefix}>}
 */
async function allocateInvoiceNumber({ kind, owner = null, date = new Date(), prefix } = {}) {
  if (!kind) throw new Error('allocateInvoiceNumber: kind is required');

  const fy = financialYear(date);
  const ownerId = owner || null;

  const series = await InvoiceSeries.findOneAndUpdate(
    { kind, owner: ownerId, financialYear: fy },
    {
      $inc: { nextSequence: 1 },
      $setOnInsert: {
        kind,
        owner: ownerId,
        financialYear: fy,
        prefix: prefix || DEFAULT_PREFIX[kind] || 'MGY',
        format: DEFAULT_FORMAT,
        sequenceWidth: 5,
        active: true,
      },
    },
    { upsert: true, new: true },
  );

  const sequence = series.nextSequence;

  return {
    number: renderInvoiceNumber(series.format, {
      prefix: series.prefix,
      financialYear: fy,
      sequence,
      sequenceWidth: series.sequenceWidth,
    }),
    sequence,
    financialYear: fy,
    seriesId: series._id,
    format: series.format,
    prefix: series.prefix,
  };
}

module.exports = {
  allocateInvoiceNumber,
  renderInvoiceNumber,
  DEFAULT_FORMAT,
  DEFAULT_PREFIX,
};
