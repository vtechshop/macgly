const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Invoice / credit note / debit note.
 *
 * ── Why one collection ────────────────────────────────────────────────────────
 * Marketplace invoices and vendor invoices are *different documents with the
 * same shape*. What differs is who supplies whom:
 *
 *   vendor_tax_invoice   supplier = vendor    recipient = buyer
 *   marketplace_invoice  supplier = Macgly    recipient = vendor  (commission, ads)
 *   credit_note          reverses an invoice of either kind
 *   debit_note           increases an invoice of either kind
 *
 * The concepts stay separate because `kind`, `supplier` and `recipient` are
 * explicit on every document. Splitting them into two collections would
 * duplicate the party, line, tax, numbering and revision structures verbatim
 * and force every reporting query to read from two places.
 *
 * ── Not wired up yet ──────────────────────────────────────────────────────────
 * Nothing writes to this collection. It is the target for the tax engine and
 * the per-vendor invoice generator. The existing on-the-fly HTML/PDF renderer
 * in services/invoiceService.js is untouched and still serves every download.
 *
 * ── Money ─────────────────────────────────────────────────────────────────────
 * Amounts are rupees (Number), matching Order and Commission. Integer paise
 * would be more precise, but a mixed-unit system across collections is a worse
 * bug risk than float rupees. Revisit as a whole-domain migration, not here.
 */

/** A party to the invoice. Snapshotted at issue time — never a live join. */
const partySchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User' }, // absent for guest buyers
  legalName: String,
  tradeName: String,
  gstin:     String,   // buyer GSTIN (B2B) or supplier GSTIN
  pan:       String,
  stateCode: String,   // '33' — drives the CGST+SGST vs IGST decision
  email:     String,
  phone:     String,
  address: {
    line1: String, line2: String, city: String,
    state: String, pincode: String,
    country: { type: String, default: 'India' },
  },
}, { _id: false });

/**
 * One tax component on one line. An array, so a line can legitimately carry
 * CGST + SGST together, or IGST alone, or any of them plus CESS.
 */
const taxLineSchema = new Schema({
  component:    { type: String, enum: ['CGST', 'SGST', 'IGST', 'CESS'], required: true },
  rate:         { type: Number, required: true },  // percent, e.g. 9
  taxableValue: { type: Number, required: true },
  amount:       { type: Number, required: true },
}, { _id: false });

const lineItemSchema = new Schema({
  product:  { type: Schema.Types.ObjectId, ref: 'Product' },
  vendorId: { type: Schema.Types.ObjectId, ref: 'User' },

  title:   String,
  sku:     String,
  hsnCode: String,                             // HSN/SAC, snapshotted from Product
  unit:    { type: String, default: 'NOS' },   // NOS, KG, MTR, BOX…

  quantity:  { type: Number, required: true },
  unitPrice: { type: Number, required: true }, // per unit, as invoiced

  grossAmount:  Number,  // quantity * unitPrice, before discount
  discount:     { type: Number, default: 0 },
  taxableValue: Number,  // the base tax is charged on
  taxes:        [taxLineSchema],
  totalAmount:  Number,  // taxableValue + sum(taxes)
}, { _id: true });

const invoiceSchema = new Schema({
  kind: {
    type: String,
    required: true,
    enum: ['vendor_tax_invoice', 'marketplace_invoice', 'credit_note', 'debit_note'],
    index: true,
  },

  // draft    — being assembled, no number yet
  // issued   — numbered and final; never mutate, supersede instead
  // cancelled/superseded — replaced by a revision or a credit note
  status: {
    type: String,
    enum: ['draft', 'issued', 'cancelled', 'superseded'],
    default: 'draft',
    index: true,
  },

  // ── Numbering (allocated by services/invoiceNumberService.js) ───────────────
  number:        String,   // rendered, e.g. 'MGY-V123/2026-27/00042'
  series:        { type: Schema.Types.ObjectId, ref: 'InvoiceSeries' },
  financialYear: String,
  sequence:      Number,

  issueDate: Date,
  dueDate:   Date,

  // ── Parties ─────────────────────────────────────────────────────────────────
  supplier:  { type: partySchema, required: true },
  recipient: { type: partySchema, required: true },

  // Delivery state for goods; decides intra-state (CGST+SGST) vs inter-state (IGST).
  placeOfSupplyStateCode: String,
  reverseCharge: { type: Boolean, default: false },

  // ── Source ──────────────────────────────────────────────────────────────────
  order:       { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  orderNumber: String,  // human orderId, kept even if the order is removed

  lines: [lineItemSchema],

  totals: {
    taxableValue: { type: Number, default: 0 },
    cgst:         { type: Number, default: 0 },
    sgst:         { type: Number, default: 0 },
    igst:         { type: Number, default: 0 },
    cess:         { type: Number, default: 0 },
    shipping:     { type: Number, default: 0 },
    discount:     { type: Number, default: 0 },
    roundOff:     { type: Number, default: 0 },
    grandTotal:   { type: Number, default: 0 },
  },

  currency: { type: String, default: 'INR' },

  // ── Revisions ───────────────────────────────────────────────────────────────
  // An issued invoice is immutable. A correction creates a new document with
  // revision + 1, linked both ways.
  revision:     { type: Number, default: 1 },
  supersedes:   { type: Schema.Types.ObjectId, ref: 'Invoice' },
  supersededBy: { type: Schema.Types.ObjectId, ref: 'Invoice' },

  // ── Credit / debit note linkage ─────────────────────────────────────────────
  references: {
    invoice:       { type: Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceNumber: String,
    reason:        String,   // 'return', 'price_correction', 'cancellation'…
  },

  // ── Rendered document metadata (the PDF itself lives in object storage) ─────
  document: {
    storageKey:  String,
    contentHash: String,   // detects tampering / confirms a regeneration matched
    generatedAt: Date,
  },

  notes: String,
  meta:  Schema.Types.Mixed,  // e-invoice IRN/QR later, without a schema change
}, { timestamps: true });

// A number is unique once assigned; drafts have none, hence sparse.
invoiceSchema.index({ number: 1 }, { unique: true, sparse: true });
// At most one tax invoice per order. Credit and debit notes reference the same
// order and are excluded by the partial filter.
invoiceSchema.index(
  { order: 1 },
  { unique: true, partialFilterExpression: { kind: 'vendor_tax_invoice' }, name: 'one_tax_invoice_per_order' },
);
invoiceSchema.index({ 'supplier.userId': 1, issueDate: -1 });
invoiceSchema.index({ 'recipient.userId': 1, issueDate: -1 });
invoiceSchema.index({ kind: 1, financialYear: 1, sequence: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
