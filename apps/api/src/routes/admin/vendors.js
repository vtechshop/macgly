const router  = require('express').Router();
const User    = require('../../models/User');
const Product = require('../../models/Product');
const Order   = require('../../models/Order');
const AppError = require('../../utils/AppError');
const notif   = require('../../utils/notificationHelper');

// ── helpers ───────────────────────────────────────────────────────────────────

function vendorStatus(v) {
  if (!v.isActive) return 'suspended';
  if (v.vendorProfile?.approved) return 'active';
  if (v.vendorProfile?.rejectionReason) return 'rejected';
  if (v.vendorProfile?.onboardingComplete) return 'pending';
  return 'incomplete';
}

function buildStatusFilter(status) {
  switch (status) {
    case 'active':
      return { 'vendorProfile.approved': true, isActive: true };
    case 'pending':
      return {
        'vendorProfile.approved': false,
        'vendorProfile.onboardingComplete': true,
        isActive: true,
        $or: [
          { 'vendorProfile.rejectionReason': { $exists: false } },
          { 'vendorProfile.rejectionReason': '' },
        ],
      };
    case 'suspended':
      return { isActive: false };
    case 'rejected':
      return {
        'vendorProfile.approved': false,
        'vendorProfile.rejectionReason': { $exists: true, $ne: '' },
        isActive: true,
      };
    default:
      return {};
  }
}

// ── GET /admin/vendors/stats ──────────────────────────────────────────────────
// MUST be before /:id
router.get('/stats', async (req, res, next) => {
  try {
    const base = { role: 'vendor' };
    const [total, active, pending, suspended, topPerformer] = await Promise.all([
      User.countDocuments({ ...base, 'vendorProfile.onboardingComplete': true }),
      User.countDocuments({ ...base, 'vendorProfile.approved': true, isActive: true }),
      User.countDocuments({
        ...base,
        'vendorProfile.approved': false,
        'vendorProfile.onboardingComplete': true,
        isActive: true,
        $or: [
          { 'vendorProfile.rejectionReason': { $exists: false } },
          { 'vendorProfile.rejectionReason': '' },
        ],
      }),
      User.countDocuments({ ...base, isActive: false }),
      User.findOne({ ...base, 'vendorProfile.approved': true, isActive: true })
        .sort({ 'vendorProfile.totalEarnings': -1 })
        .select('name vendorProfile')
        .lean(),
    ]);

    res.json({
      total,
      active,
      pending,
      suspended,
      topPerformer: topPerformer ? {
        name:       topPerformer.vendorProfile?.businessName || topPerformer.name,
        totalSales: topPerformer.vendorProfile?.totalEarnings || 0,
      } : null,
    });
  } catch (err) { next(err); }
});

// ── GET /admin/vendors — paginated list ───────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = { role: 'vendor', 'vendorProfile.onboardingComplete': true };

    Object.assign(filter, buildStatusFilter(status));

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: re },
        { email: re },
        { 'vendorProfile.businessName': re },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [vendors, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password -refreshTokens -passwordResetToken -passwordResetExpires')
        .lean(),
      User.countDocuments(filter),
    ]);

    // Enrich with product counts in one query
    const vendorIds = vendors.map((v) => v._id);
    const productCounts = await Product.aggregate([
      { $match: { vendorId: { $in: vendorIds } } },
      { $group: { _id: '$vendorId', total: { $sum: 1 } } },
    ]);
    const pMap = {};
    productCounts.forEach(({ _id, total: t }) => { pMap[_id.toString()] = t; });

    const enriched = vendors.map((v) => ({
      ...v,
      productCount:  pMap[v._id.toString()] || 0,
      vendorStatus:  vendorStatus(v),
    }));

    res.json({
      vendors: enriched,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total, pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// ── GET /admin/vendors/:id — full detail ──────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: 'vendor' })
      .select('-password -refreshTokens -passwordResetToken -passwordResetExpires')
      .lean();
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    const [productCount, orderCount] = await Promise.all([
      Product.countDocuments({ vendorId: vendor._id }),
      Order.countDocuments({ 'items.vendorId': vendor._id }),
    ]);

    res.json({
      vendor: { ...vendor, productCount, orderCount, vendorStatus: vendorStatus(vendor) },
    });
  } catch (err) { next(err); }
});

// ── PUT /admin/vendors/:id/approve ────────────────────────────────────────────
router.put('/:id/approve', async (req, res, next) => {
  try {
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'vendor' },
      { 'vendorProfile.approved': true, 'vendorProfile.rejectionReason': '', isActive: true },
      { new: true },
    ).select('-password -refreshTokens');
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    notif.notifyVendorApprovalStatus({
      vendorUserId: vendor._id,
      vendor:       vendor.vendorProfile,
      status:       'approved',
    }).catch(() => {});

    res.json({ ok: true, vendor });
  } catch (err) { next(err); }
});

// ── PUT /admin/vendors/:id/reject ─────────────────────────────────────────────
router.put('/:id/reject', async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'vendor' },
      { 'vendorProfile.approved': false, 'vendorProfile.rejectionReason': reason.trim() },
      { new: true },
    ).select('-password -refreshTokens');
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    notif.notifyVendorApprovalStatus({
      vendorUserId:    vendor._id,
      vendor:          vendor.vendorProfile,
      status:          'rejected',
      rejectionReason: reason,
    }).catch(() => {});

    res.json({ ok: true, vendor });
  } catch (err) { next(err); }
});

// ── PUT /admin/vendors/:id/suspend ────────────────────────────────────────────
router.put('/:id/suspend', async (req, res, next) => {
  try {
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'vendor' },
      { isActive: false },
      { new: true },
    ).select('-password -refreshTokens');
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    // Unpublish all products immediately
    await Product.updateMany({ vendorId: vendor._id }, { published: false });

    notif.createNotification({
      userId:  vendor._id,
      type:    'system',
      title:   'Account Suspended',
      message: 'Your vendor account has been suspended. Please contact support.',
      link:    '/dashboard/vendor/support',
    }).catch(() => {});

    res.json({ ok: true, vendor });
  } catch (err) { next(err); }
});

// ── PUT /admin/vendors/:id/unsuspend ──────────────────────────────────────────
router.put('/:id/unsuspend', async (req, res, next) => {
  try {
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'vendor' },
      { isActive: true },
      { new: true },
    ).select('-password -refreshTokens');
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    notif.createNotification({
      userId:  vendor._id,
      type:    'system',
      title:   'Account Reinstated',
      message: 'Your vendor account has been reinstated. You can now continue selling.',
      link:    '/dashboard/vendor',
    }).catch(() => {});

    res.json({ ok: true, vendor });
  } catch (err) { next(err); }
});

// ── DELETE /admin/vendors/:id ─────────────────────────────────────────────────
// Spec: does NOT delete User — demotes to customer + cascades products
router.delete('/:id', async (req, res, next) => {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: 'vendor' });
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');

    // Cascade: remove products
    await Product.deleteMany({ vendorId: vendor._id });

    // Demote User to customer (preserve account)
    await User.findByIdAndUpdate(vendor._id, {
      role: 'customer',
      vendorProfile: {
        businessName: '',
        onboardingComplete: false,
        approved: false,
        commissionRate: 10,
      },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── PUT /admin/vendors/:id/commission ─────────────────────────────────────────
router.put('/:id/commission', async (req, res, next) => {
  try {
    const rate = parseFloat(req.body.defaultCommissionPercentage ?? req.body.commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      throw new AppError('Commission must be between 0 and 100', 400, 'INVALID_COMMISSION');
    }
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'vendor' },
      { 'vendorProfile.commissionRate': rate },
      { new: true },
    ).select('-password -refreshTokens');
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    res.json({
      ok: true, vendor,
      message: `Commission updated to ${rate}% for ${vendor.vendorProfile?.businessName || vendor.name}`,
    });
  } catch (err) { next(err); }
});

// ── PUT /admin/vendors/:id/commission-rules ───────────────────────────────────
router.put('/:id/commission-rules', async (req, res, next) => {
  try {
    const { commissionRules = [] } = req.body;
    for (const rule of commissionRules) {
      if (!rule.category?.trim()) throw new AppError('Each rule must have a category', 400, 'INVALID_RULES');
      const pct = parseFloat(rule.percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) throw new AppError('Percentage must be 0–100', 400, 'INVALID_RULES');
    }
    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'vendor' },
      {
        'vendorProfile.commissionRules': commissionRules.map((r) => ({
          category:   r.category.trim(),
          percentage: parseFloat(r.percentage),
        })),
      },
      { new: true },
    ).select('-password -refreshTokens');
    if (!vendor) throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    res.json({ ok: true, vendor });
  } catch (err) { next(err); }
});

module.exports = router;
