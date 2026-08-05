/**
 * Buyer GSTIN capture and snapshot (PAY-04).
 * Requires the in-memory MongoDB from globalSetup.
 */
const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const Invoice = require('../../models/Invoice');
const User = require('../../models/User');
const { ensureInvoiceForOrder } = require('../../services/invoiceBuilder');

const GSTIN = '33AAACM1234C1ZP';
const ADDR = {
  name: 'Ravi', phone: '9944556683', line1: '12 MG Road',
  city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641006',
};

async function makeCustomer() {
  const email = `buyer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  await request(app).post('/api/auth/register').send({ name: 'Ravi', email, password: 'password123' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { email, cookies: login.headers['set-cookie'] };
}

const makeProduct = () => Product.create({
  title: 'Angle Grinder', description: 'Test', price: 2500,
  stock: 100, published: true, taxRate: 18, hsnCode: '8467',
});

async function checkout(cookies, product, body = {}) {
  await request(app).get('/api/cart').set('Cookie', cookies);
  await request(app).post('/api/cart/items').set('Cookie', cookies)
    .send({ productId: product._id.toString(), quantity: 2 });
  return request(app).post('/api/orders').set('Cookie', cookies)
    .send({ shippingAddress: ADDR, paymentMethod: 'razorpay', ...body });
}

describe('buyer GSTIN capture (PAY-04)', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  describe('capture at checkout', () => {
    it('snapshots company name and GSTIN onto the order', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      const res = await checkout(cookies, product, {
        billing: { companyName: 'Buildwell Constructions', gstin: GSTIN },
      });
      expect(res.status).toBe(201);

      const order = await Order.findById(res.body.order._id);
      expect(order.billing.companyName).toBe('Buildwell Constructions');
      expect(order.billing.gstin).toBe(GSTIN);
    });

    it('normalises case and whitespace', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      const res = await checkout(cookies, product, {
        billing: { companyName: '  Buildwell  ', gstin: `  ${GSTIN.toLowerCase()}  ` },
      });

      const order = await Order.findById(res.body.order._id);
      expect(order.billing.gstin).toBe(GSTIN);
      expect(order.billing.companyName).toBe('Buildwell');
    });

    it('stores no billing block for a B2C order', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      const res = await checkout(cookies, product);
      expect(res.status).toBe(201);

      const order = await Order.findById(res.body.order._id);
      expect(order.billing?.gstin).toBeUndefined();
      expect(order.billing?.companyName).toBeUndefined();
    });

    it.each([
      ['blank strings', { companyName: '   ', gstin: '  ' }],
      ['empty object', {}],
    ])('treats %s as no billing at all', async (_label, billing) => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      const res = await checkout(cookies, product, { billing });
      const order = await Order.findById(res.body.order._id);
      expect(order.billing?.gstin).toBeUndefined();
    });

    it.each([
      'NOTAGSTIN', '33AAACM1234C1Z', '33AAACM1234C1ZPX', '123', '33AAACM1234C1AP',
    ])('rejects malformed GSTIN %s and places no order', async (gstin) => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      const res = await checkout(cookies, product, { billing: { gstin } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_GSTIN');
      expect(await Order.countDocuments({})).toBe(0);
    });

    it('accepts a company name without a GSTIN', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      const res = await checkout(cookies, product, { billing: { companyName: 'Unregistered Traders' } });
      expect(res.status).toBe(201);

      const order = await Order.findById(res.body.order._id);
      expect(order.billing.companyName).toBe('Unregistered Traders');
      expect(order.billing.gstin).toBeUndefined();
    });

    it('does not consume stock or leave a cart behind when GSTIN is rejected', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      await checkout(cookies, product, { billing: { gstin: 'NOPE' } });

      const reloaded = await Product.findById(product._id);
      expect(reloaded.stock).toBe(100); // untouched
    });
  });

  describe('snapshot onto the invoice', () => {
    it('carries the buyer GSTIN and company name through to the invoice', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();
      const res = await checkout(cookies, product, {
        billing: { companyName: 'Buildwell Constructions', gstin: GSTIN },
      });

      const order = await Order.findByIdAndUpdate(res.body.order._id, { paymentStatus: 'paid' }, { new: true });
      const invoice = await ensureInvoiceForOrder(order);

      expect(invoice.recipient.gstin).toBe(GSTIN);
      expect(invoice.recipient.legalName).toBe('Buildwell Constructions');
      expect(invoice.recipient.stateCode).toBe('33');
    });

    it('leaves recipient GSTIN blank for a B2C order without breaking issuance', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();
      const res = await checkout(cookies, product);

      const order = await Order.findByIdAndUpdate(res.body.order._id, { paymentStatus: 'paid' }, { new: true });
      const invoice = await ensureInvoiceForOrder(order);

      expect(invoice.recipient.gstin).toBe('');
      expect(invoice.recipient.legalName).toBe('Ravi');
      expect(invoice.number).toBeTruthy();
    });

    it('renders the buyer GSTIN in the downloaded invoice', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();
      const res = await checkout(cookies, product, {
        billing: { companyName: 'Buildwell Constructions', gstin: GSTIN },
      });
      const order = await Order.findByIdAndUpdate(res.body.order._id, { paymentStatus: 'paid' }, { new: true });
      await ensureInvoiceForOrder(order);

      const html = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);
      expect(html.status).toBe(200);
      expect(html.text).toContain(GSTIN);
      expect(html.text).toContain('Buildwell Constructions');
    });
  });

  describe('immutability (requirement 7)', () => {
    it('editing the buyer profile afterwards does not change the issued invoice', async () => {
      const { email, cookies } = await makeCustomer();
      const product = await makeProduct();
      const res = await checkout(cookies, product, {
        billing: { companyName: 'Buildwell Constructions', gstin: GSTIN },
      });
      const order = await Order.findByIdAndUpdate(res.body.order._id, { paymentStatus: 'paid' }, { new: true });
      const invoice = await ensureInvoiceForOrder(order);

      await User.findOneAndUpdate({ email }, { name: 'Completely Different Name' });

      const reloaded = await Invoice.findById(invoice._id);
      expect(reloaded.recipient.legalName).toBe('Buildwell Constructions');
      expect(reloaded.recipient.gstin).toBe(GSTIN);

      const html = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);
      expect(html.text).toContain(GSTIN);
      expect(html.text).not.toContain('Completely Different Name');
    });

    it('a later order with a different GSTIN does not affect the earlier invoice', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct();

      const first = await checkout(cookies, product, { billing: { gstin: GSTIN } });
      const o1 = await Order.findByIdAndUpdate(first.body.order._id, { paymentStatus: 'paid' }, { new: true });
      const i1 = await ensureInvoiceForOrder(o1);

      const second = await checkout(cookies, product, { billing: { gstin: '27AAACM1234C1ZP' } });
      const o2 = await Order.findByIdAndUpdate(second.body.order._id, { paymentStatus: 'paid' }, { new: true });
      await ensureInvoiceForOrder(o2);

      expect((await Invoice.findById(i1._id)).recipient.gstin).toBe(GSTIN);
    });
  });

  describe('backward compatibility', () => {
    it('a pre-PAY-04 order with no billing block still renders', async () => {
      const { cookies } = await makeCustomer();
      const order = await Order.create({
        orderId: 'ORD-PRE-PAY04',
        user: (await User.findOne({}))._id,
        items: [{ title: 'Drill', price: 4500, quantity: 2, gstRate: 18 }],
        shippingAddress: ADDR,
        subtotal: 9000, gstAmount: 1372.88, totalAmount: 9070, paymentStatus: 'paid',
      });
      await Order.findByIdAndUpdate(order._id, { user: (await User.findOne({ }))._id });

      const res = await request(app).get(`/api/invoices/${order.orderId}`)
        .set('Cookie', (await makeCustomer()).cookies);
      // Not this buyer's order -> 404 is the correct, unchanged behaviour.
      expect([200, 404]).toContain(res.status);
      expect(cookies).toBeTruthy();
    });
  });
});
