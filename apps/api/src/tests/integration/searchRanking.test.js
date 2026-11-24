const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');
const { parseTerms } = require('../../utils/productSearch');

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
}));

beforeAll(connectDB);
afterAll(disconnectDB);
afterEach(clearDB);

let seq = 0;
async function seedProduct(overrides = {}) {
  const Product = require('../../models/Product');
  const n = `${Date.now()}-${++seq}`;
  return Product.create({
    title: 'Test Product', slug: `p-${n}`, sku: `SKU-${n}`, description: 'A product',
    price: 999, stock: 10, category: 'tools', published: true, ...overrides,
  });
}

const titles = (res) => res.body.products.map((p) => p.title);

describe('parseTerms', () => {
  test('splits words, drops filler words and word endings', () => {
    expect(parseTerms('Wall Drill')).toEqual(['wall', 'drill']);
    expect(parseTerms('drilling machines for the wall')).toEqual(['drill', 'machine', 'wall']);
    expect(parseTerms('   ')).toEqual([]);
  });
});

describe('product search', () => {
  test('"wall drill" also finds every other drill, with the closest matches first', async () => {
    await seedProduct({ title: 'DongCheng Impact Drill', description: 'Drills concrete and wall surfaces' });
    await seedProduct({ title: 'Cordless Driver Drill 12V' });
    await seedProduct({ title: 'Rotary Hammer Drill Machine' });
    await seedProduct({ title: 'Garden Hose 20m' });

    const res = await request(app).get('/api/catalog/products?search=wall%20drill');

    expect(res.status).toBe(200);
    expect(titles(res)).toHaveLength(3);
    expect(titles(res)[0]).toBe('DongCheng Impact Drill');
    expect(titles(res)).not.toContain('Garden Hose 20m');
    expect(res.body.pagination.total).toBe(3);
  });

  test('plural and -ing forms match', async () => {
    await seedProduct({ title: 'Bench Drill' });
    const res = await request(app).get('/api/catalog/products?search=drilling%20machines');
    expect(titles(res)).toEqual(['Bench Drill']);
  });

  test('matches on category name', async () => {
    const Category = require('../../models/Category');
    const cat = await Category.create({ name: 'Drill and Demolishing Hammers', slug: `drill-${Date.now()}` });
    await seedProduct({ title: 'DCK 1500W Breaker', categoryIds: [cat._id] });
    const res = await request(app).get('/api/catalog/products?search=drill');
    expect(titles(res)).toEqual(['DCK 1500W Breaker']);
  });

  test('matches whole words from the start, not inside other words', async () => {
    await seedProduct({ title: 'Undrilled Plate' });
    const res = await request(app).get('/api/catalog/products?search=drill');
    expect(titles(res)).toEqual([]);
  });

  test('an explicit sort is respected over relevance', async () => {
    await seedProduct({ title: 'Impact Drill Pro', price: 3000 });
    await seedProduct({ title: 'Mini Drill', price: 500 });
    const res = await request(app).get('/api/catalog/products?search=drill&sort=price_asc');
    expect(titles(res)).toEqual(['Mini Drill', 'Impact Drill Pro']);
  });

  test('pages through ranked results', async () => {
    for (let i = 0; i < 5; i++) await seedProduct({ title: `Drill ${i}` });
    const res = await request(app).get('/api/catalog/products?search=drill&limit=2&page=3');
    expect(titles(res)).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ total: 5, pages: 3, page: 3 });
  });
});
