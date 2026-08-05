/**
 * Invoice numbering allocator (P0-03). Requires the in-memory MongoDB from globalSetup.
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB } = require('./helpers');
const InvoiceSeries = require('../../models/InvoiceSeries');
const Invoice = require('../../models/Invoice');
const { allocateInvoiceNumber } = require('../../services/invoiceNumberService');

const VENDOR_A = new mongoose.Types.ObjectId();
const VENDOR_B = new mongoose.Types.ObjectId();
const FY_DATE = new Date('2026-06-01T00:00:00Z'); // FY 2026-27

describe('allocateInvoiceNumber (P0-03)', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  it('starts a new series at 1', async () => {
    const r = await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });
    expect(r.sequence).toBe(1);
    expect(r.financialYear).toBe('2026-27');
    expect(r.number).toBe('MGY/2026-27/00001');
  });

  it('increments consecutively with no gaps', async () => {
    const seqs = [];
    for (let i = 0; i < 5; i++) {
      seqs.push((await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE })).sequence);
    }
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
  });

  it('never issues the same number twice under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE })),
    );
    const numbers = results.map((r) => r.number);
    expect(new Set(numbers).size).toBe(25);
    expect(results.map((r) => r.sequence).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(await InvoiceSeries.countDocuments({})).toBe(1);
  });

  it('keeps each vendor on an independent series', async () => {
    const a1 = await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });
    const b1 = await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_B, date: FY_DATE });
    const a2 = await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });

    expect(a1.sequence).toBe(1);
    expect(b1.sequence).toBe(1); // vendor B is not affected by vendor A
    expect(a2.sequence).toBe(2);
    expect(await InvoiceSeries.countDocuments({})).toBe(2);
  });

  it('separates the platform series from vendor series', async () => {
    const platform = await allocateInvoiceNumber({ kind: 'marketplace_invoice', date: FY_DATE });
    expect(platform.sequence).toBe(1);
    expect(platform.number).toBe('MGYC/2026-27/00001');

    const series = await InvoiceSeries.findOne({ kind: 'marketplace_invoice' });
    expect(series.owner).toBeNull();
  });

  it('restarts numbering in a new financial year', async () => {
    await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });
    await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });

    const next = await allocateInvoiceNumber({
      kind: 'vendor_tax_invoice', owner: VENDOR_A, date: new Date('2027-05-01T00:00:00Z'),
    });
    expect(next.sequence).toBe(1);
    expect(next.number).toBe('MGY/2027-28/00001');
  });

  it('honours a format changed on the stored series', async () => {
    await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });
    await InvoiceSeries.updateOne(
      { kind: 'vendor_tax_invoice', owner: VENDOR_A },
      { $set: { format: 'TN/{PREFIX}-{SEQ}', prefix: 'ACME', sequenceWidth: 4 } },
    );
    const r = await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });
    expect(r.number).toBe('TN/ACME-0002');
  });

  it('uses distinct series per kind', async () => {
    await allocateInvoiceNumber({ kind: 'vendor_tax_invoice', owner: VENDOR_A, date: FY_DATE });
    const cn = await allocateInvoiceNumber({ kind: 'credit_note', owner: VENDOR_A, date: FY_DATE });
    expect(cn.sequence).toBe(1);
    expect(cn.number).toBe('MGYCN/2026-27/00001');
  });

  it('rejects a missing kind', async () => {
    await expect(allocateInvoiceNumber({})).rejects.toThrow(/kind is required/);
  });
});

describe('Invoice model (P0-03)', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  const party = (over = {}) => ({ legalName: 'Acme Tools', gstin: '33AAACM1234C1ZP', stateCode: '33', ...over });

  it('persists multiple tax components on a single line', async () => {
    const inv = await Invoice.create({
      kind: 'vendor_tax_invoice',
      supplier: party(),
      recipient: party({ legalName: 'Buyer Ltd', gstin: '27AAACM1234C1ZP', stateCode: '27' }),
      lines: [{
        title: 'Angle Grinder', hsnCode: '8467', unit: 'NOS',
        quantity: 2, unitPrice: 2500, taxableValue: 4237.29,
        taxes: [
          { component: 'IGST', rate: 18, taxableValue: 4237.29, amount: 762.71 },
          { component: 'CESS', rate: 1, taxableValue: 4237.29, amount: 42.37 },
        ],
        totalAmount: 5042.37,
      }],
    });
    expect(inv.lines[0].taxes).toHaveLength(2);
    expect(inv.lines[0].taxes[0].component).toBe('IGST');
    expect(inv.lines[0].hsnCode).toBe('8467');
    expect(inv.status).toBe('draft');
    expect(inv.revision).toBe(1);
    expect(inv.currency).toBe('INR');
  });

  it('allows many drafts without a number but enforces uniqueness once numbered', async () => {
    await Invoice.create({ kind: 'vendor_tax_invoice', supplier: party(), recipient: party() });
    await Invoice.create({ kind: 'vendor_tax_invoice', supplier: party(), recipient: party() });
    expect(await Invoice.countDocuments({ number: { $exists: false } })).toBe(2);

    await Invoice.create({ kind: 'vendor_tax_invoice', number: 'MGY/2026-27/00001', supplier: party(), recipient: party() });
    await expect(
      Invoice.create({ kind: 'vendor_tax_invoice', number: 'MGY/2026-27/00001', supplier: party(), recipient: party() }),
    ).rejects.toThrow();
  });

  it('links a credit note back to the invoice it reverses', async () => {
    const original = await Invoice.create({
      kind: 'vendor_tax_invoice', number: 'MGY/2026-27/00009',
      supplier: party(), recipient: party(),
    });
    const note = await Invoice.create({
      kind: 'credit_note', supplier: party(), recipient: party(),
      references: { invoice: original._id, invoiceNumber: original.number, reason: 'return' },
    });
    expect(note.references.invoice.toString()).toBe(original._id.toString());
    expect(note.references.reason).toBe('return');
  });

  it('supports a revision chain', async () => {
    const v1 = await Invoice.create({ kind: 'vendor_tax_invoice', supplier: party(), recipient: party() });
    const v2 = await Invoice.create({
      kind: 'vendor_tax_invoice', supplier: party(), recipient: party(),
      revision: 2, supersedes: v1._id,
    });
    await Invoice.updateOne({ _id: v1._id }, { status: 'superseded', supersededBy: v2._id });

    const reloaded = await Invoice.findById(v1._id);
    expect(reloaded.status).toBe('superseded');
    expect(reloaded.supersededBy.toString()).toBe(v2._id.toString());
    expect(v2.revision).toBe(2);
  });

  it('rejects an unknown tax component', async () => {
    await expect(Invoice.create({
      kind: 'vendor_tax_invoice', supplier: party(), recipient: party(),
      lines: [{ title: 'x', quantity: 1, unitPrice: 1,
        taxes: [{ component: 'VAT', rate: 5, taxableValue: 1, amount: 0.05 }] }],
    })).rejects.toThrow();
  });

  it('requires both parties', async () => {
    await expect(Invoice.create({ kind: 'vendor_tax_invoice' })).rejects.toThrow();
  });
});
