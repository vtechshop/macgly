const router     = require('express').Router();
const Commission = require('../../models/Commission');
const User       = require('../../models/User');
const AppError   = require('../../utils/AppError');

// ── GET /admin/payouts/pending ────────────────────────────────────────────────
// Returns vendors that have approved commissions awaiting payout
router.get('/pending', async (req, res, next) => {
  try {
    const grouped = await Commission.aggregate([
      { $match: { type: 'vendor', status: 'approved' } },
      {
        $group: {
          _id:         '$user',
          totalAmount: { $sum: '$commissionAmount' },
          count:       { $sum: 1 },
          ids:         { $push: '$_id' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    if (!grouped.length) return res.json({ payouts: [] });

    const vendorIds = grouped.map((g) => g._id);
    const vendors   = await User.find({ _id: { $in: vendorIds } })
      .select('name vendorProfile')
      .lean();
    const vMap = Object.fromEntries(vendors.map((v) => [v._id.toString(), v]));

    const payouts = grouped
      .map((g) => {
        const vendor = vMap[g._id.toString()];
        const vp     = vendor?.vendorProfile || {};
        return {
          vendorId:        g._id,
          vendorName:      vp.businessName || vendor?.name || 'Unknown',
          pendingAmount:   g.totalAmount,
          commissionCount: g.count,
          commissionIds:   g.ids,
          bankDetails: {
            accountHolderName: vp.accountHolderName || '',
            bankName:          vp.bankName          || '',
            accountNumber:     vp.bankAccount       || '',
            ifscCode:          vp.ifsc              || '',
            upiId:             vp.upiId             || '',
            verified:          vp.approved          || false,
          },
        };
      })
      .filter((p) => p.pendingAmount > 0);

    res.json({ payouts });
  } catch (err) { next(err); }
});

// ── POST /admin/payouts/process ───────────────────────────────────────────────
// Body: { vendorId, amount, paymentMethod, paymentRef, paymentProof?, commissionIds? }
router.post('/process', async (req, res, next) => {
  try {
    const { vendorId, amount, paymentMethod, paymentRef, paymentProof, commissionIds } = req.body;
    if (!vendorId)      throw new AppError('vendorId is required',      400, 'MISSING_FIELDS');
    if (!paymentMethod) throw new AppError('paymentMethod is required', 400, 'MISSING_FIELDS');
    if (!paymentRef?.trim()) throw new AppError('paymentRef (UTR) is required', 400, 'MISSING_FIELDS');

    // Determine which commissions to mark paid
    let ids = commissionIds?.length ? commissionIds : [];
    if (!ids.length) {
      // Auto-select all approved commissions for this vendor
      const pending = await Commission.find({ user: vendorId, type: 'vendor', status: 'approved' })
        .select('_id')
        .lean();
      ids = pending.map((c) => c._id);
    }

    if (!ids.length) throw new AppError('No approved commissions found for this vendor', 400, 'NOTHING_TO_PAY');

    const paidAt  = new Date();
    const update  = { status: 'paid', paidAt, paymentRef: paymentRef.trim(), paymentProof: paymentProof || '' };
    const result  = await Commission.updateMany({ _id: { $in: ids }, status: 'approved' }, update);

    // Update vendor's totalEarnings
    const totalPaid = amount || 0;
    if (totalPaid > 0) {
      await User.findByIdAndUpdate(vendorId, { $inc: { 'vendorProfile.totalEarnings': totalPaid } });
    }

    res.json({ ok: true, paid: result.modifiedCount, message: `${result.modifiedCount} commission(s) marked as paid` });
  } catch (err) { next(err); }
});

// ── POST /admin/payouts/vendor/:vendorId/batch ────────────────────────────────
// Shortcut: approve + pay all pending for a specific vendor in one shot
router.post('/vendor/:vendorId/batch', async (req, res, next) => {
  try {
    const { paymentMethod = 'manual', paymentRef, paymentProof } = req.body;
    const { vendorId } = req.params;

    // Approve all pending first
    await Commission.updateMany(
      { user: vendorId, type: 'vendor', status: 'pending' },
      { status: 'approved', approvedAt: new Date() },
    );

    // Then pay all approved
    const allApproved = await Commission.find({ user: vendorId, type: 'vendor', status: 'approved' })
      .select('_id commissionAmount')
      .lean();

    if (!allApproved.length) return res.json({ ok: true, paid: 0 });

    const ids       = allApproved.map((c) => c._id);
    const totalPaid = allApproved.reduce((s, c) => s + (c.commissionAmount || 0), 0);

    await Commission.updateMany(
      { _id: { $in: ids } },
      { status: 'paid', paidAt: new Date(), paymentRef: paymentRef?.trim() || '', paymentProof: paymentProof || '' },
    );

    if (totalPaid > 0) {
      await User.findByIdAndUpdate(vendorId, { $inc: { 'vendorProfile.totalEarnings': totalPaid } });
    }

    res.json({ ok: true, paid: ids.length, totalPaid });
  } catch (err) { next(err); }
});

module.exports = router;
