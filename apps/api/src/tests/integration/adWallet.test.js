/**
 * Ad wallet recharge verification (P0-02).
 *
 * Razorpay is mocked: `orders.fetch` returns whatever the test configures, and
 * signatures are produced with the same secret the app uses. Nothing leaves the
 * process. Requires the in-memory MongoDB from globalSetup.
 */
const crypto = require('crypto');

const rzMock = { orders: { create: jest.fn(), fetch: jest.fn() } };
jest.mock('razorpay', () => jest.fn().mockImplementation(() => rzMock));

process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret';

const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');
const User = require('../../models/User');
const AdWallet = require('../../models/AdWallet');

const SECRET = process.env.RAZORPAY_KEY_SECRET;
const ORDER_ID = 'order_TESTWALLET1';
const PAYMENT_ID = 'pay_TESTWALLET1';

const sign = (o, p) => crypto.createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');

async function makeApprovedVendor() {
  const email = `vendor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  await request(app).post('/api/auth/register').send({
    name: 'Ad Vendor', email, password: 'password123', role: 'vendor',
  });
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { 'vendorProfile.approved': true, 'vendorProfile.kycStatus': 'approved' } },
    { new: true },
  );
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return { user, cookies: login.headers['set-cookie'] };
}

/** A paid ₹500 order that legitimately belongs to `vendorId`. */
const paidOrder = (vendorId, overrides = {}) => ({
  id: ORDER_ID,
  status: 'paid',
  currency: 'INR',
  amount: 50000,
  amount_paid: 50000,
  receipt: `aw_${vendorId}_abc`,
  notes: { purpose: 'ad_wallet_recharge', vendorId: vendorId.toString(), expectedAmount: '500' },
  ...overrides,
});

describe('POST /api/vendors/ads/wallet/recharge/verify (P0-02)', () => {
  let vendor;
  let cookies;

  beforeAll(connectDB);
  afterAll(disconnectDB);

  beforeEach(async () => {
    await clearDB();
    jest.clearAllMocks();
    ({ user: vendor, cookies } = await makeApprovedVendor());
  });

  const verify = (body) => request(app)
    .post('/api/vendors/ads/wallet/recharge/verify')
    .set('Cookie', cookies)
    .send(body);

  const validBody = (extra = {}) => ({
    razorpayOrderId: ORDER_ID,
    razorpayPaymentId: PAYMENT_ID,
    razorpaySignature: sign(ORDER_ID, PAYMENT_ID),
    ...extra,
  });

  describe('the exploit', () => {
    it('ignores an inflated req.body.amount and credits the captured amount', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id));

      const res = await verify(validBody({ amount: 1000000 })); // attacker claims ₹10,00,000

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(500); // real captured amount
      const wallet = await AdWallet.findOne({ vendorId: vendor._id });
      expect(wallet.balance).toBe(500);
      expect(wallet.totalRecharged).toBe(500);
    });

    it('credits correctly when req.body.amount is absent entirely', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id));
      const res = await verify(validBody());
      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(500);
    });
  });

  describe('replay protection', () => {
    it('credits a given paymentId exactly once across repeated calls', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id));

      const first = await verify(validBody());
      const second = await verify(validBody());
      const third = await verify(validBody());

      expect(first.body.balance).toBe(500);
      expect(second.body.balance).toBe(500);
      expect(third.body.balance).toBe(500);

      const wallet = await AdWallet.findOne({ vendorId: vendor._id });
      expect(wallet.balance).toBe(500);
      expect(wallet.transactions).toHaveLength(1);
      expect(wallet.transactions[0].paymentId).toBe(PAYMENT_ID);
    });

    it('does not double-credit under concurrent verification', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id));

      const results = await Promise.all([verify(validBody()), verify(validBody()),
        verify(validBody()), verify(validBody()), verify(validBody())]);
      results.forEach((r) => expect(r.status).toBe(200));

      const wallet = await AdWallet.findOne({ vendorId: vendor._id });
      expect(wallet.balance).toBe(500);
      expect(wallet.transactions).toHaveLength(1);
    });
  });

  describe('rejections', () => {
    it('rejects a forged signature and credits nothing', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id));
      const res = await verify(validBody({ razorpaySignature: 'a'.repeat(64) }));
      expect(res.status).toBe(400);
      expect(await AdWallet.findOne({ vendorId: vendor._id })).toBeNull();
    });

    it('rejects an order belonging to another vendor', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder('64b7f0000000000000000000'));
      const res = await verify(validBody());
      expect(res.status).toBe(400);
      expect(await AdWallet.findOne({ vendorId: vendor._id })).toBeNull();
    });

    it('rejects an order that is not a wallet recharge', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id, {
        notes: { purpose: 'storefront_order', vendorId: vendor._id.toString() },
        receipt: 'MG-123456',
      }));
      const res = await verify(validBody());
      expect(res.status).toBe(400);
    });

    it('rejects an unpaid order', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id, { status: 'created', amount_paid: 0 }));
      const res = await verify(validBody());
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PAYMENT_NOT_CAPTURED');
    });

    it('rejects a non-INR order', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id, { currency: 'USD' }));
      const res = await verify(validBody());
      expect(res.status).toBe(400);
    });

    it('rejects when captured amount disagrees with the recorded expected amount', async () => {
      rzMock.orders.fetch.mockResolvedValue(paidOrder(vendor._id, {
        amount_paid: 100, // ₹1 captured against a ₹500 order
      }));
      const res = await verify(validBody());
      expect(res.status).toBe(400);
      expect(await AdWallet.findOne({ vendorId: vendor._id })).toBeNull();
    });

    it('returns 502 without crediting when Razorpay is unreachable', async () => {
      rzMock.orders.fetch.mockRejectedValue(new Error('ECONNRESET'));
      const res = await verify(validBody());
      expect(res.status).toBe(502);
      expect(res.body.error.message).not.toMatch(/ECONNRESET/);
      expect(await AdWallet.findOne({ vendorId: vendor._id })).toBeNull();
    });

    it('rejects missing verification fields', async () => {
      const res = await verify({ razorpayOrderId: ORDER_ID });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });
  });

  describe('backward compatibility', () => {
    it('accepts a pre-deploy order identified only by its legacy receipt', async () => {
      rzMock.orders.fetch.mockResolvedValue({
        id: ORDER_ID, status: 'paid', currency: 'INR',
        amount: 50000, amount_paid: 50000,
        receipt: `adwallet_${vendor._id}_1720000000000`,
        notes: {}, // created before notes were added
      });
      const res = await verify(validBody({ amount: 500 }));
      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(500);
    });
  });

  describe('create-order', () => {
    it('stores purpose, vendorId and expectedAmount in server-controlled notes', async () => {
      rzMock.orders.create.mockResolvedValue({ id: ORDER_ID, amount: 50000 });

      const res = await request(app)
        .post('/api/vendors/ads/wallet/recharge/create-order')
        .set('Cookie', cookies).send({ amount: 500 });

      expect(res.status).toBe(200);
      const arg = rzMock.orders.create.mock.calls[0][0];
      expect(arg.amount).toBe(50000);
      expect(arg.currency).toBe('INR');
      expect(arg.notes).toEqual({
        purpose: 'ad_wallet_recharge',
        vendorId: vendor._id.toString(),
        expectedAmount: '500',
      });
      expect(arg.receipt.length).toBeLessThanOrEqual(40); // Razorpay hard limit
    });

    it('rejects an amount below the ₹100 minimum', async () => {
      const res = await request(app)
        .post('/api/vendors/ads/wallet/recharge/create-order')
        .set('Cookie', cookies).send({ amount: 50 });
      expect(res.status).toBe(400);
      expect(rzMock.orders.create).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric amount', async () => {
      const res = await request(app)
        .post('/api/vendors/ads/wallet/recharge/create-order')
        .set('Cookie', cookies).send({ amount: 'free' });
      expect(res.status).toBe(400);
      expect(rzMock.orders.create).not.toHaveBeenCalled();
    });
  });
});
