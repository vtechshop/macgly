/**
 * Invoice download paths (INV-DL-01). Requires the in-memory MongoDB from globalSetup.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');
const Order = require('../../models/Order');
const User = require('../../models/User');

const VENDOR_OTHER = new mongoose.Types.ObjectId();

async function makeUser(role, extra = {}) {
  const email = `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  await request(app).post('/api/auth/register').send({ name: role, email, password: 'password123' });
  const user = await User.findOneAndUpdate({ email }, { $set: { role, ...extra } }, { new: true });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { user, cookies: login.headers['set-cookie'] };
}

const line = (title, price, qty, vendorId) => ({
  title, price, quantity: qty, gstRate: 18, sku: `SKU-${title}`, vendorId,
});

async function makeOrder(userId, items, over = {}) {
  return Order.create({
    orderId: `ORD-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
    user: userId,
    items,
    shippingAddress: { name: 'Buyer', line1: 'X', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641006' },
    subtotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
    shippingCharge: 70,
    totalAmount: items.reduce((s, i) => s + i.price * i.quantity, 0) + 70,
    paymentStatus: 'paid', status: 'delivered',
    ...over,
  });
}

describe('GET /api/invoices/:orderId (INV-DL-01)', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  describe('customer (must not regress)', () => {
    it('returns HTML for their own order, keyed by orderId', async () => {
      const { user, cookies } = await makeUser('customer');
      const order = await makeOrder(user._id, [line('Drill', 4500, 2)]);

      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Drill');
      expect(res.headers['content-disposition']).toBeUndefined();
    });

    it('cannot read another customer\'s invoice', async () => {
      const owner = await makeUser('customer');
      const other = await makeUser('customer');
      const order = await makeOrder(owner.user._id, [line('Drill', 4500, 1)]);

      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', other.cookies);
      expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
      const { user } = await makeUser('customer');
      const order = await makeOrder(user._id, [line('Drill', 4500, 1)]);
      expect((await request(app).get(`/api/invoices/${order.orderId}`)).status).toBe(401);
    });
  });

  describe('pdf format', () => {
    it('returns a real PDF with an attachment filename', async () => {
      const { user, cookies } = await makeUser('customer');
      const order = await makeOrder(user._id, [line('Drill', 4500, 2)]);

      const res = await request(app)
        .get(`/api/invoices/${order.orderId}?format=pdf`)
        .set('Cookie', cookies)
        .buffer().parse((r, cb) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toBe(`attachment; filename="invoice-${order.orderId}.pdf"`);
      expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
    });
  });

  describe('admin', () => {
    it('can read any order by orderId', async () => {
      const buyer = await makeUser('customer');
      const admin = await makeUser('admin');
      const order = await makeOrder(buyer.user._id, [line('Drill', 4500, 1)]);

      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', admin.cookies);
      expect(res.status).toBe(200);
    });

    it('can also read by Mongo _id (what the admin dashboard used to send)', async () => {
      const buyer = await makeUser('customer');
      const admin = await makeUser('admin');
      const order = await makeOrder(buyer.user._id, [line('Drill', 4500, 1)]);

      const res = await request(app).get(`/api/invoices/${order._id}`).set('Cookie', admin.cookies);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Drill');
    });
  });

  describe('vendor', () => {
    it('can download an invoice for an order containing their items', async () => {
      const buyer = await makeUser('customer');
      const vendor = await makeUser('vendor', { 'vendorProfile.approved': true });
      const order = await makeOrder(buyer.user._id, [line('Grinder', 2500, 2, vendor.user._id)]);

      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', vendor.cookies);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Grinder');
    });

    it('sees the untouched document when the whole order is theirs', async () => {
      const buyer = await makeUser('customer');
      const vendor = await makeUser('vendor', { 'vendorProfile.approved': true });
      const order = await makeOrder(buyer.user._id, [
        line('Grinder', 2500, 2, vendor.user._id),
        line('Blade', 500, 1, vendor.user._id),
      ]);

      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', vendor.cookies);
      expect(res.text).toContain('Grinder');
      expect(res.text).toContain('Blade');
      expect(res.text).toContain('5,570'); // full total incl. shipping is preserved
    });

    it('NEVER sees another vendor\'s lines on a split order', async () => {
      const buyer = await makeUser('customer');
      const vendor = await makeUser('vendor', { 'vendorProfile.approved': true });
      const order = await makeOrder(buyer.user._id, [
        line('MyGrinder', 2500, 2, vendor.user._id),
        line('RivalLathe', 90000, 1, VENDOR_OTHER),
      ]);

      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', vendor.cookies);

      expect(res.status).toBe(200);
      expect(res.text).toContain('MyGrinder');
      expect(res.text).not.toContain('RivalLathe');
      expect(res.text).not.toContain('90,000');
    });

    it('cannot read an order with none of their items', async () => {
      const buyer = await makeUser('customer');
      const vendor = await makeUser('vendor', { 'vendorProfile.approved': true });
      const order = await makeOrder(buyer.user._id, [line('Lathe', 90000, 1, VENDOR_OTHER)]);

      const res = await request(app).get(`/api/invoices/${order.orderId}`).set('Cookie', vendor.cookies);
      expect(res.status).toBe(404);
    });
  });

  describe('lookup', () => {
    it('404s for an unknown key without leaking internals', async () => {
      const { cookies } = await makeUser('admin');
      const res = await request(app).get('/api/invoices/ORD-DOES-NOT-EXIST').set('Cookie', cookies);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('404s for a well-formed but unknown ObjectId', async () => {
      const { cookies } = await makeUser('admin');
      const res = await request(app).get(`/api/invoices/${new mongoose.Types.ObjectId()}`).set('Cookie', cookies);
      expect(res.status).toBe(404);
    });
  });
});
