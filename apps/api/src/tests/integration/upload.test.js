/**
 * Admin image upload: failures must say why, not "Something went wrong".
 * No Cloudinary credentials in the test env, so the local adapter is used.
 */
const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');
const User = require('../../models/User');

async function adminAgent() {
  const email = `admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ name: 'Admin', email, password: 'password123' });
  await User.findOneAndUpdate({ email }, { role: 'admin' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return login.headers['set-cookie'];
}

describe('admin image upload errors', () => {
  beforeAll(connectDB);
  afterAll(disconnectDB);
  beforeEach(clearDB);

  it('explains that a file over 5 MB is too large', async () => {
    const cookies = await adminAgent();
    const res = await request(app).post('/api/admin/upload/image').set('Cookie', cookies)
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1, 1), { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(413);
    expect(res.body.error.message).toMatch(/too large/i);
    expect(res.body.error.message).toMatch(/5 MB/);
  });

  it('rejects a non-image with a clear message', async () => {
    const cookies = await adminAgent();
    const res = await request(app).post('/api/admin/upload/image').set('Cookie', cookies)
      .attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Only images allowed');
  });
});
