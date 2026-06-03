const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const {
  trackClick, recordClick, getStats, getOrders, generateCode, submitKyc,
  getDashboardStats, getLinks, getProductStats,
  getCommissions, getCommissionStats,
  getKYC, updateKYC, uploadKYCDocument, deleteKYCDocument, updatePaymentDetails,
  getAffiliateProfile, getPreferences, updatePreferences,
} = require('../controllers/affiliateController');

// ─── Public ───────────────────────────────────────────────────────────────────
router.get('/track', trackClick);
router.get('/record-click', optionalAuth, recordClick);

// ─── Authenticated ────────────────────────────────────────────────────────────
router.use(authenticate);

// Apply — any authenticated user (customer, vendor) can apply
router.post('/apply', async (req, res, next) => {
  try {
    const User   = require('../models/User');
    const crypto = require('crypto');
    const { paymentMethod = 'bank', paymentDetails = {} } = req.body;

    if (req.user.role === 'affiliate') {
      return res.status(400).json({ error: { code: 'ALREADY_AFFILIATE', message: 'You are already an affiliate' } });
    }

    // Generate unique referral code (e.g. "VTECH9E46")
    const namePrefix = (req.user.name || req.user.email || '')
      .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5).padEnd(5, 'X');
    let code;
    let exists = true;
    while (exists) {
      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
      code = `${namePrefix}${suffix}`;
      exists = await User.findOne({ 'affiliateProfile.referralCode': code }).lean();
    }

    const update = {
      role: 'affiliate',
      'affiliateProfile.referralCode':  code,
      'affiliateProfile.commissionRate': 5,
    };

    if (paymentMethod === 'bank' && paymentDetails.bank) {
      const { accountName, accountNumber, ifsc } = paymentDetails.bank;
      if (accountName)   update['affiliateProfile.bankDetails.accountHolderName'] = accountName;
      if (accountNumber) {
        update['affiliateProfile.bankDetails.accountNumber']  = accountNumber;
        update['affiliateProfile.bankDetails.lastFourDigits'] = accountNumber.slice(-4);
      }
      if (ifsc) update['affiliateProfile.bankDetails.ifscCode'] = ifsc.toUpperCase();
    } else if (paymentMethod === 'upi' && paymentDetails.upi?.upiId) {
      update['affiliateProfile.bankDetails.upiId'] = paymentDetails.upi.upiId;
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true });
    res.status(201).json({ user: user.toSafeObject() });
  } catch (err) { next(err); }
});

router.use(authorize(['affiliate', 'admin']));

// KYC guard — returns 403 with kycStatus payload if not approved
function requireApprovedAffiliateKYC(req, res, next) {
  const ap       = req.user?.affiliateProfile;
  const rawKyc   = ap?.kycStatus || 'not_submitted';
  const kycStatus = rawKyc === 'verified' ? 'approved' : rawKyc;
  if (!['approved', 'verified'].includes(ap?.kycStatus)) {
    return res.status(403).json({
      error: {
        code:    'KYC_NOT_APPROVED',
        message: 'Complete KYC verification to access affiliate links',
        kycStatus,
      },
    });
  }
  next();
}

// ── No KYC required ───────────────────────────────────────────────────────────
router.get('/me',                   getAffiliateProfile);
router.get('/preferences',          getPreferences);
router.put('/preferences',          updatePreferences);
router.get('/dashboard/stats',      getDashboardStats);
router.get('/stats',                getStats);            // legacy
router.get('/commissions/stats',    getCommissionStats);  // must be before /commissions
router.get('/commissions',          getCommissions);
router.get('/orders',               getOrders);
router.post('/generate-code',       generateCode);
router.post('/kyc',                 submitKyc);           // legacy simple submit

// KYC full flow (no KYC approval required — these manage KYC itself)
router.get('/kyc',                  getKYC);
router.put('/kyc',                  updateKYC);
router.post('/kyc/documents',       uploadKYCDocument);
router.delete('/kyc/documents/:documentId', deleteKYCDocument);
router.put('/payment-details',      updatePaymentDetails);

// ── Requires approved KYC ─────────────────────────────────────────────────────
router.get('/links',          requireApprovedAffiliateKYC, getLinks);
router.get('/products/stats', requireApprovedAffiliateKYC, getProductStats);

module.exports = router;
