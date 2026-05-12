const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, registerUser, app } = require('./helpers');

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

async function getAdminCookies() {
  const User = require('../../models/User');
  const admin = await User.create({
    name: 'Admin', email: 'admin@test.com', password: 'admin123', role: 'admin',
  });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return [`accessToken=${token}; Path=/; HttpOnly`];
}

async function seedProduct(overrides = {}) {
  const Product = require('../../models/Product');
  const ts = Date.now();
  return Product.create({
    title: 'Test Product',
    slug: `test-product-${ts}`,
    sku: `SKU-${ts}`,
    description: 'A test product',
    price: 999,
    stock: 10,
    category: 'electronics',
    published: true,
    ...overrides,
  });
}

describe('GET /api/catalog/products', () => {
  test('returns empty list when no products', async () => {
    const res = await request(app).get('/api/catalog/products');
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  test('returns published products', async () => {
    await seedProduct({ title: 'Phone' });
    const res = await request(app).get('/api/catalog/products');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  test('does not return unpublished products', async () => {
    await seedProduct({ title: 'Hidden', slug: 'hidden', published: false });
    const res = await request(app).get('/api/catalog/products');
    expect(res.status).toBe(200);
    expect(res.body.products.every((p) => p.isActive !== false)).toBe(true);
  });

  test('supports search query', async () => {
    await seedProduct({ title: 'iPhone 15' });
    await seedProduct({ title: 'Samsung TV' });
    const res = await request(app).get('/api/catalog/products?search=iphone');
    expect(res.status).toBe(200);
    expect(res.body.products.some((p) => p.title.toLowerCase().includes('iphone'))).toBe(true);
  });

  test('paginates results', async () => {
    for (let i = 0; i < 5; i++) {
      await seedProduct({ title: `Prod ${i}` });
    }
    const res = await request(app).get('/api/catalog/products?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('GET /api/catalog/products/:slug', () => {
  test('returns product by slug', async () => {
    const p = await seedProduct({ title: 'Laptop', slug: 'laptop-unique' });
    const res = await request(app).get(`/api/catalog/products/${p.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.product.slug).toBe(p.slug);
  });

  test('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/catalog/products/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/catalog/categories', () => {
  test('returns list of categories', async () => {
    const Category = require('../../models/Category');
    await Category.create({ name: 'Tools', slug: 'tools' });
    const res = await request(app).get('/api/catalog/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });
});

describe('Admin product management', () => {
  test('creates a product (admin only)', async () => {
    const cookies = await getAdminCookies();
    const ts = Date.now();
    const res = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({
        title: 'New Prod',
        description: 'A great product',
        price: 500,
        stock: 20,
        category: 'tools',
        slug: `new-prod-${ts}`,
        sku: `NP-${ts}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.product.title).toBe('New Prod');
  });

  test('rejects product creation without auth', async () => {
    const res = await request(app).post('/api/admin/products').send({ title: 'X', price: 100, stock: 5 });
    expect(res.status).toBe(401);
  });

  test('rejects product creation for non-admin', async () => {
    const { cookies } = await registerUser();
    const res = await request(app)
      .post('/api/admin/products')
      .set('Cookie', cookies)
      .send({ title: 'X', price: 100, stock: 5 });
    expect(res.status).toBe(403);
  });
});
