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
async function makeUser(role) {
  const User = require('../../models/User');
  const jwt = require('jsonwebtoken');
  const user = await User.create({ name: role, email: `${role}_${Date.now()}_${++seq}@t.com`, password: 'pass123', role });
  const token = jwt.sign({ id: user._id, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return { user, cookies: [`accessToken=${token}; Path=/; HttpOnly`] };
}

async function seedNotes(userId) {
  const Notification = require('../../models/Notification');
  await Notification.create([
    { user: userId, type: 'vendor_approval', title: 'Vendor Application Approved', message: 'x' },
    { user: userId, type: 'kyc', title: 'KYC', message: 'x' },
    { user: userId, type: 'order', title: 'Order shipped', message: 'x' },
  ]);
}

test('a customer does not see leftover vendor approval / KYC notifications', async () => {
  const { user, cookies } = await makeUser('customer');
  await seedNotes(user._id);

  const list = await request(app).get('/api/notifications').set('Cookie', cookies);
  const count = await request(app).get('/api/notifications/unread-count').set('Cookie', cookies);

  expect(list.body.notifications.map((n) => n.type)).toEqual(['order']);
  expect(list.body.unreadCount).toBe(1);
  expect(count.body.count).toBe(1);
});

test.each(['vendor', 'admin'])('%s still sees vendor approval / KYC notifications', async (role) => {
  const { user, cookies } = await makeUser(role);
  await seedNotes(user._id);

  const count = await request(app).get('/api/notifications/unread-count').set('Cookie', cookies);
  expect(count.body.count).toBe(3);
});
