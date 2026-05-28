const router     = require('express').Router();
const User       = require('../../models/User');
const Commission = require('../../models/Commission');
const AppError   = require('../../utils/AppError');
const notif      = require('../../utils/notificationHelper');

// ── helpers ───────────────────────────────────────────────────────────────────

function affiliateStatus(user) {
  if (!user.isActive) return 'suspended';
  const ks = user.affiliateProfile?.kycStatus;
  if (ks === 'verified')  return 'active';
  if (ks === 'pending')   return 'pending';
  if (ks === 'rejected')  return 'rejected';
  return 'incomplete';
}

// ── GET /admin/affiliates/stats — before / ────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const base = { role: 'affiliate' };

    const [total, active, pending, suspended, agg, topPerformer, totalConversions] = await Promise.all([
      User.countDocuments(base),
      User.countDocuments({ ...base, 'affiliateProfile.kycStatus': 'verified', isActive: true }),
      User.countDocuments({ ...base, 'affiliateProfile.kycStatus': 'pending' }),
      User.countDocuments({ ...base, isActive: false }),
      User.aggregate([
        { $match: base },
        { $group: {
          _id: null,
          totalClicks:     { $sum: '$affiliateProfile.totalClicks' },
          totalEarnings:   { $sum: '$affiliateProfile.totalEarnings' },
          pendingEarnings: { $sum: '$affiliateProfile.pendingEarnings' },
          totalConversions:{ $sum: '$affiliateProfile.totalConversions' },
        }},
      ]),
      Commission.aggregate([
        { $match: { type: 'affiliate' } },
        { $group: { _id: '$user', conversions: { $sum: 1 }, totalAmount: { $sum: '$commissionAmount' } } },
        { $sort: { conversions: -1 } },
        { $limit: 1 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: {
          name:        '$u.name',
          code:        '$u.affiliateProfile.referralCode',
          conversions: 1,
          totalAmount: 1,
        }},
      ]),
      Commission.countDocuments({ type: 'affiliate' }),
    ]);

    const a = agg[0] || {};
    const convRate = a.totalClicks ? ((a.totalConversions || totalConversions) / a.totalClicks) * 100 : 0;

    res.json({
      total, active, pending, suspended,
      totalClicks:      a.totalClicks      || 0,
      totalConversions: a.totalConversions || totalConversions || 0,
      totalEarnings:    a.totalEarnings    || 0,
      pendingEarnings:  a.pendingEarnings  || 0,
      conversionRate:   parseFloat(convRate.toFixed(2)),
      topPerformer:     topPerformer[0] || null,
    });
  } catch (err) { next(err); }
});

// ── GET /admin/affiliates ─────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = { role: 'affiliate' };

    if (status === 'active')     { filter['affiliateProfile.kycStatus'] = 'verified'; filter.isActive = true; }
    else if (status === 'pending')  { filter['affiliateProfile.kycStatus'] = 'pending'; }
    else if (status === 'suspended'){ filter.isActive = false; }
    else if (status === 'rejected') { filter['affiliateProfile.kycStatus'] = 'rejected'; }

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }, { 'affiliateProfile.referralCode': re }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [affiliates, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password -refreshTokens -passwordResetToken -passwordResetExpires')
        .lean(),
      User.countDocuments(filter),
    ]);

    // Enrich with per-affiliate conversion counts
    const ids = affiliates.map((a) => a._id);
    const convCounts = await Commission.aggregate([
      { $match: { type: 'affiliate', user: { $in: ids } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const convMap = {};
    convCounts.forEach(({ _id, count }) => { convMap[_id.toString()] = count; });

    const enriched = affiliates.map((a) => ({
      ...a,
      conversionCount: convMap[a._id.toString()] || a.affiliateProfile?.totalConversions || 0,
      affiliateStatus: affiliateStatus(a),
    }));

    res.json({
      affiliates: enriched,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// ── GET /admin/affiliates/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const affiliate = await User.findOne({ _id: req.params.id, role: 'affiliate' })
      .select('-password -refreshTokens -passwordResetToken -passwordResetExpires')
      .lean();
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');

    const convCount = await Commission.countDocuments({ type: 'affiliate', user: affiliate._id });
    res.json({
      affiliate: { ...affiliate, conversionCount: convCount, affiliateStatus: affiliateStatus(affiliate) },
    });
  } catch (err) { next(err); }
});

// ── PUT /admin/affiliates/:id/approve ─────────────────────────────────────────
router.put('/:id/approve', async (req, res, next) => {
  try {
    const affiliate = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'affiliate' },
      {
        'affiliateProfile.kycStatus':       'verified',
        'affiliateProfile.rejectionReason': '',
        'affiliateProfile.approvedAt':      new Date(),
        isActive: true,
      },
      { new: true },
    ).select('-password -refreshTokens');
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');

    notif.notifyAffiliateApprovalStatus({ affiliateUserId: affiliate._id, status: 'approved' }).catch(() => {});
    res.json({ ok: true, affiliate });
  } catch (err) { next(err); }
});

// ── PUT /admin/affiliates/:id/reject ──────────────────────────────────────────
router.put('/:id/reject', async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    const affiliate = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'affiliate' },
      {
        'affiliateProfile.kycStatus':       'rejected',
        'affiliateProfile.rejectionReason': reason.trim(),
      },
      { new: true },
    ).select('-password -refreshTokens');
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');

    notif.notifyAffiliateApprovalStatus({ affiliateUserId: affiliate._id, status: 'rejected', rejectionReason: reason }).catch(() => {});
    res.json({ ok: true, affiliate });
  } catch (err) { next(err); }
});

// ── PUT /admin/affiliates/:id/suspend ─────────────────────────────────────────
router.put('/:id/suspend', async (req, res, next) => {
  try {
    const affiliate = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'affiliate' },
      { isActive: false },
      { new: true },
    ).select('-password -refreshTokens');
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');

    notif.createNotification({
      userId:  affiliate._id,
      type:    'system',
      title:   'Account Suspended',
      message: 'Your affiliate account has been suspended. Contact support for more information.',
      link:    '/dashboard/affiliate/support',
    }).catch(() => {});

    res.json({ ok: true, affiliate });
  } catch (err) { next(err); }
});

// ── PUT /admin/affiliates/:id/unsuspend ───────────────────────────────────────
router.put('/:id/unsuspend', async (req, res, next) => {
  try {
    const affiliate = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'affiliate' },
      { isActive: true },
      { new: true },
    ).select('-password -refreshTokens');
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');
    res.json({ ok: true, affiliate });
  } catch (err) { next(err); }
});

// ── DELETE /admin/affiliates/:id ──────────────────────────────────────────────
// Cascades commissions, demotes user to customer
router.delete('/:id', async (req, res, next) => {
  try {
    const affiliate = await User.findOne({ _id: req.params.id, role: 'affiliate' });
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');

    await Commission.deleteMany({ user: affiliate._id, type: 'affiliate' });
    await User.findByIdAndUpdate(affiliate._id, {
      role: 'customer',
      affiliateProfile: { kycStatus: 'not_submitted', commissionRate: 5, totalEarnings: 0, totalClicks: 0 },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── PUT /admin/affiliates/:id/commission-rules ────────────────────────────────
router.put('/:id/commission-rules', async (req, res, next) => {
  try {
    const { commissionRules = [] } = req.body;
    for (const r of commissionRules) {
      const pct = parseFloat(r.percentage);
      if (!r.category?.trim() || isNaN(pct) || pct < 0 || pct > 100) {
        throw new AppError('Each rule must have a valid category and percentage 0–100', 400, 'INVALID_RULES');
      }
    }
    const affiliate = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'affiliate' },
      { 'affiliateProfile.commissionRules': commissionRules.map((r) => ({ category: r.category.trim(), percentage: parseFloat(r.percentage) })) },
      { new: true },
    ).select('-password -refreshTokens');
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');
    res.json({ ok: true, affiliate });
  } catch (err) { next(err); }
});

// ── POST /admin/affiliates/:id/payout ────────────────────────────────────────
// Body: { amount, paymentMethod, reference, paymentProof? }
router.post('/:id/payout', async (req, res, next) => {
  try {
    const { amount, paymentMethod, reference, paymentProof } = req.body;
    const grossAmount = parseFloat(amount);
    if (isNaN(grossAmount) || grossAmount <= 0) throw new AppError('Amount must be > 0', 400, 'INVALID_AMOUNT');
    if (!paymentMethod) throw new AppError('paymentMethod is required', 400, 'MISSING_FIELDS');
    if (!reference?.trim()) throw new AppError('UTR / reference is required', 400, 'MISSING_FIELDS');

    const affiliate = await User.findOne({ _id: req.params.id, role: 'affiliate' }).lean();
    if (!affiliate) throw new AppError('Affiliate not found', 404, 'NOT_FOUND');

    const pending = affiliate.affiliateProfile?.pendingEarnings || 0;
    if (grossAmount > pending + 1) throw new AppError(`Amount exceeds pending earnings (₹${pending})`, 400, 'AMOUNT_EXCEEDS');

    // Mark commissions paid FIFO
    const commissions = await Commission.find({ user: affiliate._id, type: 'affiliate', status: 'approved' })
      .sort({ createdAt: 1 })
      .lean();

    let remaining = grossAmount;
    const paidIds = [];
    for (const c of commissions) {
      if (remaining <= 0) break;
      paidIds.push(c._id);
      remaining -= c.commissionAmount;
    }

    if (paidIds.length) {
      await Commission.updateMany(
        { _id: { $in: paidIds } },
        {
          status:        'paid',
          paidAt:        new Date(),
          paymentRef:    reference.trim(),
          paymentProof:  paymentProof || '',
          note:          `Manual payout via ${paymentMethod} | Ref: ${reference.trim()}`,
        },
      );
    }

    // Update affiliate earnings
    await User.findByIdAndUpdate(affiliate._id, {
      $inc: {
        'affiliateProfile.pendingEarnings': -grossAmount,
        'affiliateProfile.paidEarnings':    grossAmount,
      },
    });

    res.json({ ok: true, paid: paidIds.length, grossAmount });
  } catch (err) { next(err); }
});

module.exports = router;
