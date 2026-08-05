/**
 * Order-time tax snapshot (GST-HSN-01, and PAY-01/PAY-02 end-to-end).
 *
 * Drives the real createOrder controller. RAZORPAY_KEY_ID is unset in the test
 * env, so the Razorpay client is null and no gateway call is attempted.
 * Requires the in-memory MongoDB from globalSetup.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const User = require('../../models/User');

const TN_ADDRESS = {
  name: 'Buyer', phone: '9944556683', line1: '9/83 E 4th Street',
  city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641006',
};
const MH_ADDRESS = { ...TN_ADDRESS, city: 'Pune', state: 'Maharashtra', pincode: '411001' };

async function makeCustomer() {
  const email = `buyer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  await request(app).post('/api/auth/register').send({ name: 'Buyer', email, password: 'password123' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { cookies: login.headers['set-cookie'] };
}

async function makeVendor(gstin) {
  const email = `vendor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  await request(app).post('/api/auth/register').send({ name: 'Vendor', email, password: 'password123' });
  return User.findOneAndUpdate(
    { email },
    { $set: { role: 'vendor', 'vendorProfile.approved': true, 'vendorProfile.gstin': gstin } },
    { new: true },
  );
}

const makeProduct = (over = {}) => Product.create({
  title: 'Angle Grinder', description: 'Test', price: 2500, stock: 100, published: true, ...over,
});

/** Adds a product to the cart and places the order; returns the created Order. */
async function placeOrder(cookies, product, shippingAddress = TN_ADDRESS, quantity = 1) {
  await request(app).get('/api/cart').set('Cookie', cookies);
  const add = await request(app).post('/api/cart/items').set('Cookie', cookies)
    .send({ productId: product._id.toString(), quantity });
  expect(add.status).toBe(200);

  const res = await request(app).post('/api/orders').set('Cookie', cookies)
    .send({ shippingAddress, paymentMethod: 'razorpay' });
  expect(res.status).toBe(201);
  return Order.findById(res.body.order._id);
}

describe('order tax snapshot', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  describe('HSN snapshot (GST-HSN-01)', () => {
    it('copies product.hsnCode onto the order item', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ hsnCode: '8467', taxRate: 18 });

      const order = await placeOrder(cookies, product);
      expect(order.items[0].hsnCode).toBe('8467');
    });

    it('leaves hsnCode unset when the product has none', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ taxRate: 18 });

      const order = await placeOrder(cookies, product);
      expect(order.items[0].hsnCode).toBeUndefined();
    });

    it('stores undefined rather than an empty string', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ hsnCode: '   ', taxRate: 18 });

      const order = await placeOrder(cookies, product);
      expect(order.items[0].hsnCode).toBeUndefined();
    });

    it('is immutable — editing the product afterwards does not change the order', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ hsnCode: '8467', taxRate: 18 });
      const order = await placeOrder(cookies, product);

      await Product.findByIdAndUpdate(product._id, { hsnCode: '9999' });

      const reloaded = await Order.findById(order._id);
      expect(reloaded.items[0].hsnCode).toBe('8467');
    });

    it('survives deletion of the product', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ hsnCode: '8467', taxRate: 18 });
      const order = await placeOrder(cookies, product);

      await Product.findByIdAndDelete(product._id);

      const reloaded = await Order.findById(order._id);
      expect(reloaded.items[0].hsnCode).toBe('8467');
      expect(reloaded.items[0].gstRate).toBe(18);
    });
  });

  describe('rate and components (PAY-01 / PAY-02 through the real controller)', () => {
    it('stamps the configured rate, not the 18% fallback', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ taxRate: 5, hsnCode: '8201' });

      const order = await placeOrder(cookies, product);
      expect(order.items[0].gstRate).toBe(5);
      expect(order.items[0].taxableValue).toBeCloseTo(2380.95, 2);
    });

    it('splits intra-state into CGST + SGST', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ taxRate: 18 }); // admin product -> platform state 33

      const order = await placeOrder(cookies, product, TN_ADDRESS);
      expect(order.placeOfSupplyStateCode).toBe('33');
      expect(order.items[0].cgst).toBeCloseTo(190.68, 2);
      expect(order.items[0].sgst).toBeCloseTo(190.68, 2);
      expect(order.items[0].igst).toBe(0);
    });

    it('charges IGST inter-state', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ taxRate: 18 });

      const order = await placeOrder(cookies, product, MH_ADDRESS);
      expect(order.placeOfSupplyStateCode).toBe('27');
      expect(order.items[0].igst).toBeCloseTo(381.36, 2);
      expect(order.items[0].cgst).toBe(0);
      expect(order.items[0].sgst).toBe(0);
    });

    it('uses the vendor GSTIN state, not the platform state', async () => {
      const { cookies } = await makeCustomer();
      const vendor = await makeVendor('27AAACM1234C1ZP'); // Maharashtra
      const product = await makeProduct({ taxRate: 18, vendorId: vendor._id });

      const order = await placeOrder(cookies, product, TN_ADDRESS); // buyer in TN
      expect(order.items[0].igst).toBeCloseTo(381.36, 2); // inter-state
    });

    it('leaves components unset for a vendor with no GSTIN', async () => {
      const { cookies } = await makeCustomer();
      const vendor = await makeVendor('');
      const product = await makeProduct({ taxRate: 18, vendorId: vendor._id });

      const order = await placeOrder(cookies, product, TN_ADDRESS);
      expect(order.items[0].cgst).toBeUndefined();
      expect(order.items[0].igst).toBeUndefined();
      expect(order.items[0].taxableValue).toBeCloseTo(2118.64, 2); // still computed
    });

    it('keeps order.gstAmount on its original formula', async () => {
      const { cookies } = await makeCustomer();
      const product = await makeProduct({ taxRate: 18 });

      const order = await placeOrder(cookies, product, TN_ADDRESS, 2);
      expect(order.gstAmount).toBeCloseTo(762.71, 2); // 5000 * 18 / 118
    });
  });

  describe('backward compatibility', () => {
    it('an order written without the new fields still loads and validates', async () => {
      const legacy = await Order.create({
        orderId: 'ORD-LEGACY-X',
        items: [{ title: 'Drill', price: 4500, quantity: 2, gstRate: 18 }],
        shippingAddress: TN_ADDRESS,
        subtotal: 9000, gstAmount: 1372.88, totalAmount: 9070, paymentStatus: 'paid',
      });
      const reloaded = await Order.findById(legacy._id);
      expect(reloaded.items[0].hsnCode).toBeUndefined();
      expect(reloaded.items[0].cgst).toBeUndefined();
      expect(reloaded.placeOfSupplyStateCode).toBeUndefined();
      expect(reloaded.gstAmount).toBe(1372.88);
    });
  });
});

describe('gstService removal (GST-DEAD-01)', () => {
  it('the module no longer exists', () => {
    expect(() => require('../../services/gstService')).toThrow(/Cannot find module/);
  });

  it('the app still boots with every route mounted', () => {
    expect(() => require('../../app')).not.toThrow();
  });

  it('mongoose has no orphaned model from it', () => {
    expect(mongoose.modelNames()).not.toContain('GstService');
  });
});
