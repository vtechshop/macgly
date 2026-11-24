const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
}));
jest.mock('../../services/emailService', () => ({
  sendContactMessage: jest.fn().mockResolvedValue(),
  sendPasswordReset: jest.fn(),
  sendOrderConfirmation: jest.fn(),
}));

beforeAll(connectDB);
afterAll(disconnectDB);
afterEach(clearDB);

test('a contact form submission notifies every admin in the dashboard', async () => {
  const User = require('../../models/User');
  const Notification = require('../../models/Notification');
  const admin = await User.create({ name: 'Admin', email: `a_${Date.now()}@test.com`, password: 'pass123', role: 'admin' });
  const customer = await User.create({ name: 'C', email: `c_${Date.now()}@test.com`, password: 'pass123', role: 'customer' });

  const res = await request(app).post('/api/contact').send({
    name: 'Ravi', email: 'ravi@example.com', subject: 'Bulk order', message: 'Need 50 drills',
  });
  expect(res.status).toBe(200);

  // notifyAdmins runs after the response; give it a moment to write.
  let notes = [];
  for (let i = 0; i < 20 && !notes.length; i++) {
    await new Promise((r) => setTimeout(r, 50));
    notes = await Notification.find({ user: admin._id });
  }
  expect(notes).toHaveLength(1);
  expect(notes[0].title).toBe('New contact message');
  expect(notes[0].message).toBe('Ravi: Bulk order');
  expect(notes[0].link).toBe('/dashboard/admin/contact-submissions');
  expect(await Notification.countDocuments({ user: customer._id })).toBe(0);
});
