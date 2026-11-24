const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
}));

beforeAll(connectDB);
afterAll(disconnectDB);
afterEach(clearDB);

let seq = 0;
async function createUser(role, vendorProfile) {
  const User = require('../../models/User');
  const jwt = require('jsonwebtoken');
  const user = await User.create({
    name: 'Vendor', email: `v_${Date.now()}_${++seq}@test.com`, password: 'pass123', role,
    ...(vendorProfile ? { vendorProfile } : {}),
  });
  const token = jwt.sign({ id: user._id, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return { user, cookies: [`accessToken=${token}; Path=/; HttpOnly`] };
}

async function seedProduct(vendorId) {
  const Product = require('../../models/Product');
  const ts = `${Date.now()}-${++seq}`;
  return Product.create({
    title: 'Vendor Product', slug: `vp-${ts}`, sku: `VSKU-${ts}`, description: 'x',
    price: 100, stock: 1, vendorId, published: false,
  });
}

const cancel = (cookies) => request(app).post('/api/users/cancel-vendor').set('Cookie', cookies);

describe('POST /api/users/cancel-vendor', () => {
  test('unapproved vendor goes back to customer and loses unsold products', async () => {
    const { user, cookies } = await createUser('vendor', { businessName: 'Oops Ltd', approved: false });
    await seedProduct(user._id);

    const res = await cancel(cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('customer');
    const User = require('../../models/User');
    const Product = require('../../models/Product');
    const saved = await User.findById(user._id);
    expect(saved.role).toBe('customer');
    expect(saved.vendorProfile.businessName).toBe('');
    expect(await Product.countDocuments({ vendorId: user._id })).toBe(0);
  });

  test('the account keeps working as a customer straight away', async () => {
    const { cookies } = await createUser('vendor', { approved: false });
    await cancel(cookies);

    const res = await request(app).get('/api/users/profile').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('customer');
  });

  test('approved vendor is refused', async () => {
    const { cookies } = await createUser('vendor', { approved: true });
    const res = await cancel(cookies);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VENDOR_APPROVED');
  });

  test('vendor with an order is refused and keeps their products', async () => {
    const { user, cookies } = await createUser('vendor', { approved: false });
    const product = await seedProduct(user._id);
    const Order = require('../../models/Order');
    await Order.collection.insertOne({
      orderId: `ORD-V-${Date.now()}`,
      items: [{ product: product._id, vendorId: user._id, title: 'x', price: 100, quantity: 1 }],
    });

    const res = await cancel(cookies);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VENDOR_HAS_ORDERS');
    const Product = require('../../models/Product');
    expect(await Product.countDocuments({ vendorId: user._id })).toBe(1);
  });

  test('customer is refused', async () => {
    const { cookies } = await createUser('customer');
    const res = await cancel(cookies);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_VENDOR');
  });
});
