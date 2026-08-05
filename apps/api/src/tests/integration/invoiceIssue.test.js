/**
 * Rule 46 invoice issuance (PAY-03). Requires the in-memory MongoDB from globalSetup.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');
const Order = require('../../models/Order');
const Invoice = require('../../models/Invoice');
const InvoiceSeries = require('../../models/InvoiceSeries');
const User = require('../../models/User');
const { ensureInvoiceForOrder } = require('../../services/invoiceBuilder');

const ADDR = {
  name: 'Buyer', phone: '9944556683', line1: '12 MG Road',
  city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641006',
};

async function makeUser(role = 'customer', extra = {}) {
  const email = `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  await request(app).post('/api/auth/register').send({ name: role, email, password: 'password123' });
  const user = await User.findOneAndUpdate({ email }, { $set: { role, ...extra } }, { new: true });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { user, cookies: login.headers['set-cookie'] };
}

const line = (over = {}) => ({
  title: 'Angle Grinder', sku: 'AG-4', price: 2500, quantity: 2, gstRate: 18,
  hsnCode: '8467', taxableValue: 4237.29, cgst: 381.36, sgst: 381.35, igst: 0, ...over,
});

async function makePaidOrder(userId, items = [line()], over = {}) {
  return Order.create({
    orderId: `ORD-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
    user: userId, items, shippingAddress: ADDR, placeOfSupplyStateCode: '33',
    subtotal: 5000, gstAmount: 762.71, shippingCharge: 70, totalAmount: 5070,
    paymentStatus: 'paid', paymentMethod: 'razorpay', razorpayPaymentId: 'pay_TEST',
    ...over,
  });
}

describe('ensureInvoiceForOrder (PAY-03)', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  it('issues a numbered, immutable invoice from order snapshot data', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id);

    const inv = await ensureInvoiceForOrder(order);

    expect(inv.kind).toBe('vendor_tax_invoice');
    expect(inv.status).toBe('issued');
    expect(inv.number).toMatch(/^MGY\/\d{4}-\d{2}\/\d{5}$/);
    expect(inv.sequence).toBe(1);
    expect(inv.order.toString()).toBe(order._id.toString());
    expect(inv.orderNumber).toBe(order.orderId);
    expect(inv.placeOfSupplyStateCode).toBe('33');
  });

  it('copies HSN, taxable value and the tax split from the order line', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id);

    const inv = await ensureInvoiceForOrder(order);
    const l = inv.lines[0];

    expect(l.hsnCode).toBe('8467');
    expect(l.taxableValue).toBeCloseTo(4237.29, 2);
    expect(l.taxes.map((t) => t.component).sort()).toEqual(['CGST', 'SGST']);
    expect(l.taxes.find((t) => t.component === 'CGST').amount).toBeCloseTo(381.36, 2);
    expect(inv.totals.cgst).toBeCloseTo(381.36, 2);
    expect(inv.totals.igst).toBe(0);
    expect(inv.totals.grandTotal).toBe(5070);
  });

  it('records IGST when the order line carried it', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id, [line({ cgst: 0, sgst: 0, igst: 762.71 })]);

    const inv = await ensureInvoiceForOrder(order);
    expect(inv.lines[0].taxes.map((t) => t.component)).toEqual(['IGST']);
    expect(inv.totals.igst).toBeCloseTo(762.71, 2);
    expect(inv.totals.cgst).toBe(0);
  });

  it('is idempotent — repeated calls return the same document and burn no numbers', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id);

    const a = await ensureInvoiceForOrder(order);
    const b = await ensureInvoiceForOrder(order);
    const c = await ensureInvoiceForOrder(order);

    expect(b._id.toString()).toBe(a._id.toString());
    expect(c.number).toBe(a.number);
    expect(await Invoice.countDocuments({})).toBe(1);
    const series = await InvoiceSeries.findOne({});
    expect(series.nextSequence).toBe(1);
  });

  it('issues at most one invoice under concurrency', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id);

    await Promise.all(Array.from({ length: 5 }, () => ensureInvoiceForOrder(order)));
    expect(await Invoice.countDocuments({ order: order._id })).toBe(1);
  });

  it('refuses to issue for an unpaid order', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id, [line()], { paymentStatus: 'pending' });

    expect(await ensureInvoiceForOrder(order)).toBeNull();
    expect(await Invoice.countDocuments({})).toBe(0);
  });

  describe('supplier resolution', () => {
    it('uses the vendor and their own numbering series for a single-vendor order', async () => {
      const { user } = await makeUser();
      const { user: vendor } = await makeUser('vendor', {
        'vendorProfile.businessName': 'Acme Tools Pvt Ltd',
        'vendorProfile.gstin': '33AAACM1234C1ZP',
      });
      const order = await makePaidOrder(user._id, [line({ vendorId: vendor._id })]);

      const inv = await ensureInvoiceForOrder(order);
      expect(inv.supplier.legalName).toBe('Acme Tools Pvt Ltd');
      expect(inv.supplier.gstin).toBe('33AAACM1234C1ZP');
      expect(inv.supplier.stateCode).toBe('33');

      const series = await InvoiceSeries.findOne({});
      expect(series.owner.toString()).toBe(vendor._id.toString());
    });

    it('uses the platform for admin-owned stock', async () => {
      const { user } = await makeUser();
      const order = await makePaidOrder(user._id);

      const inv = await ensureInvoiceForOrder(order);
      expect(inv.supplier.legalName).toBe('Macgly');
      expect(inv.supplier.stateCode).toBe('33');

      const series = await InvoiceSeries.findOne({});
      expect(series.owner).toBeNull();
    });

    it('falls back to the platform and flags a multi-vendor order', async () => {
      const { user } = await makeUser();
      const { user: v1 } = await makeUser('vendor');
      const { user: v2 } = await makeUser('vendor');
      const order = await makePaidOrder(user._id, [line({ vendorId: v1._id }), line({ vendorId: v2._id })]);

      const inv = await ensureInvoiceForOrder(order);
      expect(inv.supplier.legalName).toBe('Macgly');
      expect(inv.meta.multiSupplierOrder).toBe(true);
    });
  });

  it('gives each vendor an independent consecutive series', async () => {
    const { user } = await makeUser();
    const { user: vendor } = await makeUser('vendor', { 'vendorProfile.gstin': '33AAACM1234C1ZP' });

    const o1 = await makePaidOrder(user._id, [line({ vendorId: vendor._id })]);
    const o2 = await makePaidOrder(user._id, [line({ vendorId: vendor._id })]);

    expect((await ensureInvoiceForOrder(o1)).sequence).toBe(1);
    expect((await ensureInvoiceForOrder(o2)).sequence).toBe(2);
  });

  it('captures the buyer GSTIN when the order carries billing details', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id, [line()], {
      billing: { companyName: 'Buildwell Constructions', gstin: '33BBBCM1234C1ZP' },
    });

    const inv = await ensureInvoiceForOrder(order);
    expect(inv.recipient.legalName).toBe('Buildwell Constructions');
    expect(inv.recipient.gstin).toBe('33BBBCM1234C1ZP');
  });

  it('remains valid after the order is deleted — it is a snapshot', async () => {
    const { user } = await makeUser();
    const order = await makePaidOrder(user._id);
    const inv = await ensureInvoiceForOrder(order);

    await Order.findByIdAndDelete(order._id);

    const reloaded = await Invoice.findById(inv._id);
    expect(reloaded.lines[0].hsnCode).toBe('8467');
    expect(reloaded.orderNumber).toBe(order.orderId);
  });
});

describe('invoice download after PAY-03', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  it('renders the issued invoice for a customer, with Rule 46 fields', async () => {
    const { user, cookies } = await makeUser();
    const order = await makePaidOrder(user._id);
    await ensureInvoiceForOrder(order);

    const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/MGY\/\d{4}-\d{2}\/\d{5}/); // invoice number, not orderId
    expect(res.text).toContain('HSN/SAC');
    expect(res.text).toContain('8467');
    expect(res.text).toContain('Place of Supply');
    expect(res.text).not.toContain('GST (18%)'); // the old hardcoded label
  });

  it('issues lazily when a paid order has no invoice yet', async () => {
    const { user, cookies } = await makeUser();
    const order = await makePaidOrder(user._id);
    expect(await Invoice.countDocuments({})).toBe(0);

    const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(await Invoice.countDocuments({ order: order._id })).toBe(1);
  });

  it('uses the legacy Order renderer for an unpaid order and issues nothing', async () => {
    const { user, cookies } = await makeUser();
    const order = await makePaidOrder(user._id, [line()], { paymentStatus: 'pending' });

    const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.text).toContain('ORDER SUMMARY');
    expect(await Invoice.countDocuments({})).toBe(0);
  });

  it('keeps vendors on the scoped Order view so split orders stay private', async () => {
    const { user } = await makeUser();
    const { user: vendor, cookies } = await makeUser('vendor', { 'vendorProfile.approved': true });
    const other = new mongoose.Types.ObjectId();
    const order = await makePaidOrder(user._id, [
      line({ title: 'MyGrinder', vendorId: vendor._id }),
      line({ title: 'RivalLathe', price: 90000, vendorId: other }),
    ]);
    await ensureInvoiceForOrder(order);

    const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.text).toContain('MyGrinder');
    expect(res.text).not.toContain('RivalLathe');
  });

  it('serves a PDF from the issued invoice', async () => {
    const { user, cookies } = await makeUser();
    const order = await makePaidOrder(user._id);
    await ensureInvoiceForOrder(order);

    const res = await request(app)
      .get(`/api/invoices/${order.orderId}?format=pdf`).set('Cookie', cookies)
      .buffer().parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('admin can read it by _id as well as orderId', async () => {
    const { user } = await makeUser();
    const { cookies } = await makeUser('admin');
    const order = await makePaidOrder(user._id);
    await ensureInvoiceForOrder(order);

    expect((await request(app).get(`/api/invoices/${order._id}`).set('Cookie', cookies)).status).toBe(200);
    expect((await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies)).status).toBe(200);
  });

  describe('backward compatibility', () => {
    it('renders a pre-PAY-03 order with no snapshot fields through the legacy path', async () => {
      const { user, cookies } = await makeUser();
      const order = await Order.create({
        orderId: 'ORD-LEGACY-1',
        user: user._id,
        items: [{ title: 'Drill', price: 4500, quantity: 2, gstRate: 18 }], // no hsn/cgst/taxableValue
        shippingAddress: ADDR,
        subtotal: 9000, gstAmount: 1372.88, totalAmount: 9070, paymentStatus: 'paid',
      });

      // Lazy issuance kicks in because the order is paid — it must still render.
      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Drill');
      expect(res.text).toContain('9,070.00');
    });
  });
});
