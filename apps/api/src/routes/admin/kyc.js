const router = require('express').Router();
const User   = require('../../models/User');
const AppError = require('../../utils/AppError');
const notif  = require('../../utils/notificationHelper');
const { sendVendorKYCDecisionEmail } = require('../../services/emailService');
const { writeAuditLog, fromReq } = require('../../middleware/audit');
const CloudinaryAdapter = require('../../adapters/storage/CloudinaryAdapter');

const cloudinaryAdapter = new CloudinaryAdapter();

// Extract publicId, format, and resourceType from a Cloudinary URL.
// Handles both 'upload' (public) and 'authenticated' delivery types.
function extractDocumentInfo(url) {
  if (!url) return { publicId: null, format: null, resourceType: 'image' };
  try {
    const match = url.match(/\/(image|video|raw)\/(upload|authenticated)\/(?:v\d+\/)?(.+?)(?:\.([a-z0-9]+))?$/i);
    if (!match) return { publicId: null, format: null, resourceType: 'image' };
    return {
      publicId: match[3],
      format: match[4] || null,       // e.g. 'pdf', 'jpg', 'png'
      resourceType: match[1] === 'raw' ? 'raw' : 'image',
    };
  } catch { return { publicId: null, format: null, resourceType: 'image' }; }
}

// Replace raw Cloudinary URLs with 5-minute signed URLs in a vendorProfile.
// Passes the actual format (pdf/jpg/png) and resource type so the signed URL
// covers the correct resource instead of defaulting to a broken .jpg link.
function signKycDocuments(vendorProfile) {
  if (!vendorProfile?.kycDocuments?.length) return vendorProfile;
  const signed = vendorProfile.kycDocuments.map((doc) => {
    const { publicId, format, resourceType } = extractDocumentInfo(doc.url);
    const signedUrl = publicId
      ? cloudinaryAdapter.signedUrl(publicId, { format, resourceType })
      : doc.url;
    return { ...doc, url: signedUrl };
  });
  return { ...vendorProfile, kycDocuments: signed };
}

// ── GET /admin/kyc/pending — merged queue with type tag ───────────────────────
// MUST be before / so Express doesn't treat 'pending' as an :id param
router.get('/pending', async (req, res, next) => {
  try {
    const { type } = req.query;
    const now = Date.now();

    let vendorItems = [], affiliateItems = [];

    if (!type || type === 'vendor') {
      const vendors = await User.find({
        role: 'vendor',
        'vendorProfile.onboardingComplete': true,
        'vendorProfile.approved': false,
      })
        .select('name email phone emailVerified createdAt vendorProfile')
        .lean();
      vendorItems = vendors.map((v) => ({ ...v, type: 'vendor' }));
    }

    if (!type || type === 'affiliate') {
      const affiliates = await User.find({
        role: 'affiliate',
        'affiliateProfile.kycStatus': 'pending',
      })
        .select('name email phone emailVerified createdAt affiliateProfile')
        .lean();
      affiliateItems = affiliates.map((a) => ({ ...a, type: 'affiliate' }));
    }

    // Oldest first so urgent items surface at the top
    const data = [...vendorItems, ...affiliateItems]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const urgent      = data.filter((s) => (now - new Date(s.createdAt).getTime()) / 86400000 >= 7).length;
    const gstVerified = vendorItems.filter((v) => v.vendorProfile?.gstin).length;

    res.json({
      data,
      meta: {
        total:           data.length,
        totalVendors:    vendorItems.length,
        totalAffiliates: affiliateItems.length,
        urgent,
        gstVerified,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /admin/kyc — legacy format (keep for backward compat) ─────────────────
router.get('/', async (req, res, next) => {
  try {
    const [vendors, affiliates] = await Promise.all([
      User.find({ role: 'vendor', 'vendorProfile.onboardingComplete': true })
        .select('name email createdAt vendorProfile'),
      User.find({ role: 'affiliate', 'affiliateProfile.kycStatus': { $in: ['pending', 'verified', 'rejected'] } })
        .select('name email createdAt affiliateProfile'),
    ]);

    const pendingVendors    = vendors.filter((v) => !v.vendorProfile?.approved);
    const pendingAffiliates = affiliates.filter((a) => a.affiliateProfile?.kycStatus === 'pending');

    res.json({
      vendors, affiliates,
      counts: {
        pendingVendors:    pendingVendors.length,
        pendingAffiliates: pendingAffiliates.length,
        total:             pendingVendors.length + pendingAffiliates.length,
        gstVerified:       vendors.filter((v) => v.vendorProfile?.gstin).length,
        urgent: [...pendingVendors, ...pendingAffiliates].filter((u) => {
          return (Date.now() - new Date(u.createdAt).getTime()) / 86400000 >= 7;
        }).length,
      },
    });
  } catch (err) { next(err); }
});

// ── Plural routes (new) ───────────────────────────────────────────────────────

router.put('/vendors/:id/approve', async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'vendor' });
    if (!user) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    const { force } = req.body;
    const vp   = user.vendorProfile || {};
    const docs = vp.kycDocuments || [];

    if (!force) {
      if (!vp.businessName?.trim() || !vp.businessType || !vp.businessAddress?.trim() || !vp.businessPhone?.trim()) {
        throw new AppError('Business information is incomplete', 400, 'INCOMPLETE_KYC');
      }
      if (!vp.gstVerified) {
        throw new AppError('GST has not been verified', 400, 'GST_NOT_VERIFIED');
      }
      if (!docs.some((d) => d.type === 'id_proof') || !docs.some((d) => d.type === 'address_proof')) {
        throw new AppError('ID proof and address proof documents are required', 400, 'MISSING_DOCUMENTS');
      }
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      {
        'vendorProfile.approved': true,
        'vendorProfile.rejectionReason': '',
        'vendorProfile.kycStatus': 'approved',
        'vendorProfile.kycVerifiedAt': new Date(),
        'vendorProfile.kycVerifiedBy': req.user._id,
      },
      { new: true },
    );
    writeAuditLog({ ...fromReq(req), action: 'KYC_APPROVED', target: updated._id, targetModel: 'User', meta: { vendorEmail: updated.email } });
    notif.notifyVendorApprovalStatus({ vendorUserId: updated._id, vendor: updated.vendorProfile, status: 'approved' }).catch(() => {});
    sendVendorKYCDecisionEmail({ vendor: updated, status: 'approved' }).catch(() => {});
    res.json({ ok: true, user: updated });
  } catch (err) { next(err); }
});

router.put('/vendors/:id/reject', async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'vendor' },
      {
        'vendorProfile.approved': false,
        'vendorProfile.rejectionReason': reason.trim(),
        'vendorProfile.kycStatus': 'rejected',
        'vendorProfile.kycRejectionReason': reason.trim(),
      },
      { new: true },
    );
    if (!updated) throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    writeAuditLog({ ...fromReq(req), action: 'KYC_REJECTED', target: updated._id, targetModel: 'User', meta: { vendorEmail: updated.email, reason: reason.slice(0, 200) } });
    notif.notifyVendorApprovalStatus({ vendorUserId: updated._id, vendor: updated.vendorProfile, status: 'rejected', rejectionReason: reason }).catch(() => {});
    sendVendorKYCDecisionEmail({ vendor: updated, status: 'rejected', rejectionReason: reason }).catch(() => {});
    res.json({ ok: true, user: updated });
  } catch (err) { next(err); }
});

router.put('/affiliates/:id/approve', async (req, res, next) => {
  try {
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'affiliate' },
      {
        'affiliateProfile.kycStatus':     'verified',
        'affiliateProfile.rejectionReason': '',
        'affiliateProfile.approvedAt':    new Date(),
        isActive: true,
      },
      { new: true },
    );
    if (!updated) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');
    notif.notifyAffiliateApprovalStatus({ affiliateUserId: updated._id, status: 'approved' }).catch(() => {});
    res.json({ ok: true, user: updated });
  } catch (err) { next(err); }
});

router.put('/affiliates/:id/reject', async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'affiliate' },
      {
        'affiliateProfile.kycStatus':             'rejected',
        'affiliateProfile.rejectionReason':       reason.trim(),
        'affiliateProfile.kycData.rejectionReason': reason.trim(),
      },
      { new: true },
    );
    if (!updated) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');
    notif.notifyAffiliateApprovalStatus({ affiliateUserId: updated._id, status: 'rejected', rejectionReason: reason }).catch(() => {});
    res.json({ ok: true, user: updated });
  } catch (err) { next(err); }
});

// ── Singular routes (backward compat) ────────────────────────────────────────

router.put('/vendor/:id/approve', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { 'vendorProfile.approved': true }, { new: true });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    notif.notifyVendorApprovalStatus({ vendorUserId: user._id, vendor: user.vendorProfile, status: 'approved' }).catch(() => {});
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

router.put('/vendor/:id/reject', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { 'vendorProfile.approved': false, 'vendorProfile.rejectionReason': reason || '' }, { new: true });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    notif.notifyVendorApprovalStatus({ vendorUserId: user._id, vendor: user.vendorProfile, status: 'rejected', rejectionReason: reason }).catch(() => {});
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

router.put('/affiliate/:id/approve', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { 'affiliateProfile.kycStatus': 'verified' }, { new: true });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    notif.notifyAffiliateApprovalStatus({ affiliateUserId: user._id, status: 'approved' }).catch(() => {});
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

router.put('/affiliate/:id/reject', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { 'affiliateProfile.kycStatus': 'rejected', 'affiliateProfile.kycData.rejectionReason': reason || '' }, { new: true });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    notif.notifyAffiliateApprovalStatus({ affiliateUserId: user._id, status: 'rejected', rejectionReason: reason }).catch(() => {});
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

// ── GET /admin/kyc/vendors/:id/documents — signed URLs for KYC document access ──
router.get('/vendors/:id/documents', async (req, res, next) => {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: 'vendor' })
      .select('name email vendorProfile.kycDocuments vendorProfile.kycStatus')
      .lean();
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    writeAuditLog({
      ...fromReq(req),
      action: 'KYC_DOCUMENTS_ACCESSED',
      target: vendor._id,
      targetModel: 'User',
      meta: { vendorEmail: vendor.email, documentCount: vendor.vendorProfile?.kycDocuments?.length || 0 },
    });

    const signedProfile = signKycDocuments(vendor.vendorProfile || {});

    res.json({
      kycStatus: signedProfile.kycStatus,
      kycDocuments: signedProfile.kycDocuments || [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
