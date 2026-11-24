const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
}));
jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn(),
  sendContactMessage: jest.fn().mockResolvedValue(),
  sendPasswordReset: jest.fn(),
  sendOrderConfirmation: jest.fn(),
}));

const { sendEmail } = require('../../services/emailService');

beforeAll(connectDB);
afterAll(disconnectDB);
afterEach(async () => { await clearDB(); sendEmail.mockReset(); });

async function adminCookies() {
  const User = require('../../models/User');
  const jwt = require('jsonwebtoken');
  const admin = await User.create({ name: 'Admin', email: `a_${Date.now()}@test.com`, password: 'pass123', role: 'admin' });
  const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return [`accessToken=${token}; Path=/; HttpOnly`];
}

async function seedSubmission() {
  const ContactSubmission = require('../../models/ContactSubmission');
  return ContactSubmission.create({ name: 'Ravi', email: 'ravi@example.com', subject: 'Bulk order', message: 'Need <50> drills' });
}

test('admin reply is emailed to the customer with reply-to the support inbox', async () => {
  sendEmail.mockResolvedValue(true);
  const cookies = await adminCookies();
  const sub = await seedSubmission();

  const res = await request(app)
    .post(`/api/admin/contact-submissions/${sub._id}/reply`)
    .set('Cookie', cookies)
    .send({ message: 'Yes, we can supply 50.' });

  expect(res.status).toBe(200);
  expect(res.body.emailSent).toBe(true);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const mail = sendEmail.mock.calls[0][0];
  expect(mail.to).toBe('ravi@example.com');
  expect(mail.replyTo).toBeTruthy();
  expect(mail.subject).toBe('Re: Bulk order');
  expect(mail.html).toContain('Yes, we can supply 50.');
  expect(mail.html).toContain('Need &lt;50&gt; drills');
  expect(res.body.data.status).toBe('replied');
});

test('reports emailSent=false and still saves the reply when email is not configured', async () => {
  sendEmail.mockResolvedValue(false);
  const cookies = await adminCookies();
  const sub = await seedSubmission();

  const res = await request(app)
    .post(`/api/admin/contact-submissions/${sub._id}/reply`)
    .set('Cookie', cookies)
    .send({ message: 'Hello' });

  expect(res.status).toBe(200);
  expect(res.body.emailSent).toBe(false);
  expect(res.body.data.replies).toHaveLength(1);
});
