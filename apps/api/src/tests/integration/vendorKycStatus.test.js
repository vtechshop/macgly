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
async function makeUser(role, vendorProfile) {
  const User = require('../../models/User');
  const jwt = require('jsonwebtoken');
  const user = await User.create({
    name: role, email: `${role}_${Date.now()}_${++seq}@t.com`, password: 'pass123', role,
    ...(vendorProfile ? { vendorProfile } : {}),
  });
  const token = jwt.sign({ id: user._id, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return { user, cookies: [`accessToken=${token}; Path=/; HttpOnly`] };
}

const User = () => require('../../models/User');
const Notification = () => require('../../models/Notification');

test('becoming a vendor does not mark KYC as under review, and clears old approval notices', async () => {
  const { user, cookies } = await makeUser('customer');
  await Notification().create({ user: user._id, type: 'vendor_approval', title: 'Vendor Application Approved', message: 'x' });

  const res = await request(app).post('/api/vendors/onboard').set('Cookie', cookies).send({ storeName: 'Vtech' });

  expect(res.status).toBe(200);
  const saved = await User().findById(user._id);
  expect(saved.role).toBe('vendor');
  expect(saved.vendorProfile.kycStatus).toBe('not_submitted');
  expect(await Notification().countDocuments({ user: user._id })).toBe(0);
});

test('a vendor stuck "under review" with no documents is repaired when the KYC page loads', async () => {
  const { user, cookies } = await makeUser('vendor', { onboardingComplete: true, approved: false, kycStatus: 'pending' });
  await Notification().create({ user: user._id, type: 'vendor_approval', title: 'Vendor Application Approved', message: 'x' });

  const res = await request(app).get('/api/vendors/kyc').set('Cookie', cookies);

  expect(res.status).toBe(200);
  expect(res.body.data.status).toBe('not_submitted');
  expect((await User().findById(user._id)).vendorProfile.kycStatus).toBe('not_submitted');
  expect(await Notification().countDocuments({ user: user._id })).toBe(0);
});

test('a genuinely submitted KYC (documents uploaded) stays under review', async () => {
  const { user, cookies } = await makeUser('vendor', {
    onboardingComplete: true, approved: false, kycStatus: 'pending',
    kycDocuments: [{ type: 'id_proof', url: 'a' }, { type: 'address_proof', url: 'b' }],
  });

  const res = await request(app).get('/api/vendors/kyc').set('Cookie', cookies);

  expect(res.body.data.status).toBe('pending');
  expect((await User().findById(user._id)).vendorProfile.kycStatus).toBe('pending');
});

test('becoming a vendor via /users/become-vendor clears old approval notices', async () => {
  const { user, cookies } = await makeUser('customer');
  await Notification().create({ user: user._id, type: 'kyc', title: 'KYC Approved', message: 'x' });
  await Notification().create({ user: user._id, type: 'order', title: 'Shipped', message: 'x' });

  await request(app).post('/api/users/become-vendor').set('Cookie', cookies).send({ businessName: 'Vtech' });

  const left = await Notification().find({ user: user._id });
  expect(left.map((n) => n.type)).toEqual(['order']);
});
