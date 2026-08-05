const router     = require('express').Router();
const Commission = require('../../models/Commission');
const User       = require('../../models/User');
const AppError   = require('../../utils/AppError');
const { payApprovedCommissions } = require('../../services/commissionService');

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
// Body: { vendorId, paymentMethod, paymentRef, paymentProof?, commissionIds? }
// `amount` is still accepted for backward compatibility but is deliberately
// ignored: the amount paid is the sum of the commissions being marked paid, not
// a figure supplied by the caller.
router.post('/process', async (req, res, next) => {
  try {
    const { vendorId, paymentMethod, paymentRef, paymentProof, commissionIds } = req.body;
    if (!vendorId)      throw new AppError('vendorId is required',      400, 'MISSING_FIELDS');
    if (!paymentMethod) throw new AppError('paymentMethod is required', 400, 'MISSING_FIELDS');
    if (!paymentRef?.trim()) throw new AppError('paymentRef (UTR) is required', 400, 'MISSING_FIELDS');

    // The amount is the sum of the rows actually marked paid — never a figure
    // from the request. vendorProfile.totalEarnings is deliberately not touched:
    // it is credited once on delivery by applyEarnings.
    const r = await payApprovedCommissions({
      userId: vendorId,
      type: 'vendor',
      commissionIds,
      payment: { paymentRef: paymentRef.trim(), paymentProof: paymentProof || '' },
    });

    if (!r.selectedCount) throw new AppError('No approved commissions found for this vendor', 400, 'NOTHING_TO_PAY');

    res.json({
      ok: true,
      paid: r.paidCount,
      totalPaid: r.totalPaid,
      ...(r.shortfall > 0 && { shortfall: r.shortfall }),
      message: `${r.paidCount} commission(s) marked as paid, ₹${r.totalPaid.toFixed(2)}`
        + (r.shortfall > 0 ? ` (${r.selectedCount - r.paidCount} became unavailable — verify before transferring)` : ''),
    });
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

    // Same helper as /process — the total is derived from the rows that moved.
    const r = await payApprovedCommissions({
      userId: vendorId,
      type: 'vendor',
      payment: { paymentRef: paymentRef?.trim() || '', paymentProof: paymentProof || '' },
    });

    if (!r.selectedCount) return res.json({ ok: true, paid: 0, totalPaid: 0 });

    res.json({
      ok: true,
      paid: r.paidCount,
      totalPaid: r.totalPaid,
      ...(r.shortfall > 0 && { shortfall: r.shortfall }),
    });
  } catch (err) { next(err); }
});

module.exports = router;
