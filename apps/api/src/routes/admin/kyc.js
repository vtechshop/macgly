const router = require('express').Router();
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

// GET all pending KYC — vendors awaiting approval + affiliates with pending KYC
router.get('/', async (req, res, next) => {
  try {
    const [vendors, affiliates] = await Promise.all([
      User.find({ role: 'vendor', 'vendorProfile.onboardingComplete': true })
        .select('name email createdAt vendorProfile'),
      User.find({ role: 'affiliate', 'affiliateProfile.kycStatus': { $in: ['pending', 'verified', 'rejected'] } })
        .select('name email createdAt affiliateProfile'),
    ]);

    const pendingVendors = vendors.filter((v) => !v.vendorProfile?.approved);
    const pendingAffiliates = affiliates.filter((a) => a.affiliateProfile?.kycStatus === 'pending');

    res.json({
      vendors,
      affiliates,
      counts: {
        pendingVendors: pendingVendors.length,
        pendingAffiliates: pendingAffiliates.length,
        total: pendingVendors.length + pendingAffiliates.length,
        gstVerified: vendors.filter((v) => v.vendorProfile?.gstin).length,
        urgent: [...pendingVendors, ...pendingAffiliates].filter((u) => {
          const days = (Date.now() - new Date(u.createdAt).getTime()) / 86400000;
          return days >= 7;
        }).length,
      },
    });
  } catch (err) { next(err); }
});

// Approve vendor
router.put('/vendor/:id/approve', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'vendorProfile.approved': true },
      { new: true }
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

// Reject vendor (set onboardingComplete back so they can resubmit)
router.put('/vendor/:id/reject', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'vendorProfile.approved': false, 'vendorProfile.rejectionReason': reason || '' },
      { new: true }
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

// Approve affiliate KYC
router.put('/affiliate/:id/approve', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'affiliateProfile.kycStatus': 'verified' },
      { new: true }
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

// Reject affiliate KYC
router.put('/affiliate/:id/reject', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'affiliateProfile.kycStatus': 'rejected', 'affiliateProfile.kycData.rejectionReason': reason || '' },
      { new: true }
    );
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

module.exports = router;
