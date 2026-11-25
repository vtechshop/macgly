const request = require('supertest');
const { connectDB, disconnectDB, clearDB, app } = require('./helpers');

jest.mock('../../config/redis', () => ({ getRedis: () => null }));
jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
}));
jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn(),
  sendVendorKYCDecisionEmail: jest.fn().mockResolvedValue(),
  sendVendorKYCSubmittedEmail: jest.fn().mockResolvedValue(),
  sendPasswordReset: jest.fn(),
  sendOrderConfirmation: jest.fn(),
}));

beforeAll(connectDB);
afterAll(disconnectDB);
afterEach(clearDB);

let seq = 0;
async function makeUser(role, vendorProfile) {
  const User = require('../../models/User');
  const jwt = require('jsonwebtoken');
  const user = await User.create({
    name: role, email: `${role}_${Date.now()}_${++seq}@test.com`, password: 'pass123', role,
    ...(vendorProfile ? { vendorProfile } : {}),
  });
  const token = jwt.sign({ id: user._id, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return { user, cookies: [`accessToken=${token}; Path=/; HttpOnly`] };
}

const completeKyc = {
  businessName: 'Tools Co', businessType: 'proprietorship', businessAddress: '1 Main St',
  businessPhone: '9876543210', panCard: 'ABCDE1234F',
  bankAccount: '1234567890', ifsc: 'SBIN0001234', accountHolderName: 'Tools Co',
  kycDocuments: [{ type: 'id_proof', url: 'x' }, { type: 'address_proof', url: 'y' }],
};

const ROUTES = [
  ['Admin → Vendors', (id) => `/api/admin/vendors/${id}/approve`],
  ['Admin → KYC Review', (id) => `/api/admin/kyc/vendors/${id}/approve`],
  ['legacy KYC route', (id) => `/api/admin/kyc/vendor/${id}/approve`],
];

describe.each(ROUTES)('%s approve', (_name, url) => {
  test('refuses a vendor still on Business Details, and leaves them unapproved', async () => {
    const { cookies } = await makeUser('admin');
    const { user: vendor } = await makeUser('vendor', { approved: false });

    const res = await request(app).put(url(vendor._id)).set('Cookie', cookies).send({ force: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('KYC_INCOMPLETE');
    expect(res.body.error.message).toMatch(/ID proof document/);
    const User = require('../../models/User');
    expect((await User.findById(vendor._id)).vendorProfile.approved).toBe(false);
  });

  test('approves a vendor with complete KYC and no GSTIN', async () => {
    const { cookies } = await makeUser('admin');
    const { user: vendor } = await makeUser('vendor', { ...completeKyc, approved: false });

    const res = await request(app).put(url(vendor._id)).set('Cookie', cookies);

    expect(res.status).toBe(200);
    const User = require('../../models/User');
    const saved = await User.findById(vendor._id);
    expect(saved.vendorProfile.approved).toBe(true);
    expect(saved.vendorProfile.kycStatus).toBe('approved');
  });

  test('approving a vendor with a valid GSTIN marks it verified (admin checked it)', async () => {
    const { cookies } = await makeUser('admin');
    const { user: vendor } = await makeUser('vendor', { ...completeKyc, gstin: '22AAAAA0000A1Z5', gstVerified: false });

    const res = await request(app).put(url(vendor._id)).set('Cookie', cookies);

    expect(res.status).toBe(200);
    const User = require('../../models/User');
    expect((await User.findById(vendor._id)).vendorProfile.gstVerified).toBe(true);
  });

  test('refuses a malformed GSTIN', async () => {
    const { cookies } = await makeUser('admin');
    const { user: vendor } = await makeUser('vendor', { ...completeKyc, gstin: '27AAACR5055K1Z' });

    const res = await request(app).put(url(vendor._id)).set('Cookie', cookies);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/valid GSTIN/);
  });
});

describe('vendor KYC page: GST is optional and checked by an admin', () => {
  const kycBase = { businessName: 'Tools Co', businessType: 'individual', businessAddress: '1 Main St', phoneNumber: '9876543210' };
  const docs = [{ type: 'id_proof', url: 'a' }, { type: 'address_proof', url: 'b' }];

  test('can submit KYC without a GSTIN', async () => {
    const { user, cookies } = await makeUser('vendor', { onboardingComplete: true, kycDocuments: docs });
    const res = await request(app).put('/api/vendors/kyc').set('Cookie', cookies).send({ ...kycBase, taxId: '', submit: true });
    expect(res.status).toBe(200);
    const User = require('../../models/User');
    expect((await User.findById(user._id)).vendorProfile.kycStatus).toBe('pending');
  });

  test('can submit KYC with an unverified but valid GSTIN', async () => {
    const { cookies } = await makeUser('vendor', { onboardingComplete: true, kycDocuments: docs });
    const res = await request(app).put('/api/vendors/kyc').set('Cookie', cookies)
      .send({ ...kycBase, taxId: '27aaacr5055k1z7', submit: true });
    expect(res.status).toBe(200);
    expect(res.body.data.gstin).toBe('27AAACR5055K1Z7');
  });

  test('rejects a malformed GSTIN', async () => {
    const { cookies } = await makeUser('vendor', { onboardingComplete: true });
    const res = await request(app).put('/api/vendors/kyc').set('Cookie', cookies).send({ taxId: '27AAACR' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_GSTIN');
  });

  test('changing the GSTIN clears an earlier verification', async () => {
    const { user, cookies } = await makeUser('vendor', { onboardingComplete: true, gstin: '22AAAAA0000A1Z5', gstVerified: true });
    await request(app).put('/api/vendors/kyc').set('Cookie', cookies).send({ taxId: '27AAACR5055K1Z7' });
    const User = require('../../models/User');
    expect((await User.findById(user._id)).vendorProfile.gstVerified).toBe(false);
  });
});
