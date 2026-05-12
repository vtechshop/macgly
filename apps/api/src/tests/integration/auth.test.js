const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');

// Mock email service so no real emails are sent
jest.mock('../../services/emailService', () => ({
  sendPasswordReset: jest.fn().mockResolvedValue(true),
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
}));

beforeAll(connectDB);
afterAll(disconnectDB);
afterEach(clearDB);

describe('POST /api/auth/register', () => {
  test('registers a new customer and returns user + cookies', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'secret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Alice', email: 'alice@test.com', role: 'customer' });
    expect(res.body.user.password).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toContain('accessToken');
    expect(cookieStr).toContain('refreshToken');
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELDS');
  });

  test('returns 409 when email already exists', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.com', password: 'pass123' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Bob2', email: 'bob@test.com', password: 'pass456' });
    expect(res.status).toBe(409);
  });

  test('assigns vendor role when role=vendor', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Vendor', email: 'vendor@test.com', password: 'pass123', role: 'vendor',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('vendor');
  });

  test('ignores attempts to register as admin', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Hacker', email: 'hacker@test.com', password: 'pass123', role: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({ name: 'Carol', email: 'carol@test.com', password: 'pass123' });
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'carol@test.com', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('carol@test.com');
    const cookies = res.headers['set-cookie'];
    expect(Array.isArray(cookies) ? cookies.join(';') : cookies).toContain('accessToken');
  });

  test('returns 401 with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'carol@test.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'pass123' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when fields missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'carol@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELDS');
  });
});

describe('GET /api/auth/me', () => {
  test('returns user when authenticated', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Dave', email: 'dave@test.com', password: 'pass123' });
    const cookies = reg.headers['set-cookie'];

    const res = await request(app).get('/api/auth/me').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('dave@test.com');
  });

  test('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});

describe('POST /api/auth/logout', () => {
  test('clears cookies on logout', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Eve', email: 'eve@test.com', password: 'pass123' });
    const cookies = reg.headers['set-cookie'];

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify Set-Cookie headers clear the tokens
    const setCookie = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie'].join(';')
      : (res.headers['set-cookie'] || '');
    expect(setCookie).toMatch(/accessToken=;|accessToken=$/);
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('returns ok even for unknown email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('returns 400 when email not provided', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});
