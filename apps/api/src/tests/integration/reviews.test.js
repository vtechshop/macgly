const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
}));
jest.mock('../../services/emailService', () => ({
  sendPasswordReset: jest.fn(),
  sendOrderConfirmation: jest.fn(),
}));

beforeAll(connectDB);
afterAll(disconnectDB);
afterEach(clearDB);

async function createUserWithToken(role = 'customer') {
  const User = require('../../models/User');
  const jwt = require('jsonwebtoken');
  const user = await User.create({
    name: 'User', email: `u_${Date.now()}@test.com`, password: 'pass123', role,
  });
  const token = jwt.sign({ id: user._id, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return { user, token, cookies: [`accessToken=${token}; Path=/; HttpOnly`] };
}

async function seedProduct() {
  const Product = require('../../models/Product');
  const ts = Date.now();
  return Product.create({
    title: 'Reviewed Product',
    slug: `prod-${ts}`,
    sku: `SKU-${ts}`,
    description: 'Test product for reviews',
    price: 500,
    stock: 5,
    category: 'electronics',
    published: true,
  });
}

async function createDeliveredOrder(userId, productId) {
  const Order = require('../../models/Order');
  return Order.create({
    user: userId,
    orderId: `ORD-TEST-${Date.now()}`,
    status: 'delivered',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    deliveredAt: new Date(),
    items: [{ product: productId, title: 'Reviewed Product', price: 500, quantity: 1 }],
    totalAmount: 500,
    shippingAddress: { name: 'Test', phone: '9999999999', addressLine1: '123 St', city: 'City', state: 'State', pincode: '123456', country: 'India' },
  });
}

describe('GET /api/reviews/product/:productId', () => {
  test('returns empty reviews for new product', async () => {
    const product = await seedProduct();
    const res = await request(app).get(`/api/reviews/product/${product._id}`);
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
    expect(res.body.hasReviewed).toBe(false);
    expect(res.body.hasPurchased).toBe(false);
  });

  test('returns hasPurchased=true for user with delivered order', async () => {
    const product = await seedProduct();
    const { user, cookies } = await createUserWithToken('customer');
    await createDeliveredOrder(user._id, product._id);

    const res = await request(app)
      .get(`/api/reviews/product/${product._id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.hasPurchased).toBe(true);
  });

  test('hasPurchased=true for admin without order', async () => {
    const product = await seedProduct();
    const { cookies } = await createUserWithToken('admin');

    const res = await request(app)
      .get(`/api/reviews/product/${product._id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.hasPurchased).toBe(true);
  });

  test('returns 200 with empty result for invalid productId format', async () => {
    const res = await request(app).get('/api/reviews/product/invalid-id');
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
  });
});

describe('POST /api/reviews', () => {
  test('allows customer with delivered order to review', async () => {
    const product = await seedProduct();
    const { user, cookies } = await createUserWithToken('customer');
    await createDeliveredOrder(user._id, product._id);

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', cookies)
      .send({ productId: product._id.toString(), rating: 5, title: 'Great!', body: 'Loved it.' });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.verified).toBe(true);
  });

  test('blocks customer without purchase', async () => {
    const product = await seedProduct();
    const { cookies } = await createUserWithToken('customer');

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', cookies)
      .send({ productId: product._id.toString(), rating: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_PURCHASED');
  });

  test('allows admin to review any product without order', async () => {
    const product = await seedProduct();
    const { cookies } = await createUserWithToken('admin');

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', cookies)
      .send({ productId: product._id.toString(), rating: 3, title: 'Admin review' });

    expect(res.status).toBe(201);
  });

  test('returns 409 on duplicate review', async () => {
    const product = await seedProduct();
    const { user, cookies } = await createUserWithToken('customer');
    await createDeliveredOrder(user._id, product._id);

    await request(app).post('/api/reviews').set('Cookie', cookies)
      .send({ productId: product._id.toString(), rating: 5 });

    const res = await request(app).post('/api/reviews').set('Cookie', cookies)
      .send({ productId: product._id.toString(), rating: 4 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_REVIEW');
  });

  test('returns 401 when not logged in', async () => {
    const product = await seedProduct();
    const res = await request(app).post('/api/reviews')
      .send({ productId: product._id.toString(), rating: 5 });
    expect(res.status).toBe(401);
  });

  test('returns 400 when rating missing', async () => {
    const product = await seedProduct();
    const { cookies } = await createUserWithToken('admin');
    const res = await request(app).post('/api/reviews').set('Cookie', cookies)
      .send({ productId: product._id.toString() });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/reviews/:id', () => {
  test('customer can delete their own review', async () => {
    const product = await seedProduct();
    const { user, cookies } = await createUserWithToken('customer');
    await createDeliveredOrder(user._id, product._id);

    const create = await request(app).post('/api/reviews').set('Cookie', cookies)
      .send({ productId: product._id.toString(), rating: 5 });
    const reviewId = create.body.review._id;

    const del = await request(app).delete(`/api/reviews/${reviewId}`).set('Cookie', cookies);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
  });

  test('returns 404 for non-existent review', async () => {
    const { cookies } = await createUserWithToken('admin');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/reviews/${fakeId}`).set('Cookie', cookies);
    expect(res.status).toBe(404);
  });
});
