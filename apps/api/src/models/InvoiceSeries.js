const mongoose = require('mongoose');

/**
 * A numbering series. One row per (kind, owner, financial year).
 *
 * Indian tax invoices need a number that is consecutive and unique within a
 * financial year, per supplier. On a marketplace each vendor is its own
 * supplier, so each vendor gets its own series; `owner: null` is the platform's
 * own series (commission and ad invoices Macgly raises on vendors).
 *
 * The format is data, not code — see services/invoiceNumberService.js.
 * Placeholders: {PREFIX} {FY} {SEQ}
 */
const invoiceSeriesSchema = new mongoose.Schema({
  kind: {
    type: String,
    required: true,
    enum: ['vendor_tax_invoice', 'marketplace_invoice', 'credit_note', 'debit_note'],
  },

  // null = the platform itself. Otherwise the supplying vendor.
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  financialYear: { type: String, required: true }, // '2026-27'

  prefix:         { type: String, required: true },
  format:         { type: String, required: true }, // e.g. '{PREFIX}/{FY}/{SEQ}'
  sequenceWidth:  { type: Number, default: 5 },

  // Deliberately has NO schema default: the allocator creates it via $inc so the
  // first allocation is 1. A default would race with $inc on upsert.
  nextSequence:   { type: Number },

  active: { type: Boolean, default: true },
}, { timestamps: true });

// One series per supplier per kind per year — this is what makes numbers consecutive.
invoiceSeriesSchema.index({ kind: 1, owner: 1, financialYear: 1 }, { unique: true });

module.exports = mongoose.model('InvoiceSeries', invoiceSeriesSchema);
