const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const AffiliateClick = require('../models/AffiliateClick');
const AppError = require('../utils/AppError');
const { FRONTEND_URL } = require('../config/env');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Legacy redirect-based tracking (kept for any old links in circulation)
async function trackClick(req, res, next) {
  try {
    const { ref, redirect = '/' } = req.query;
    if (ref && /^[A-Z0-9]{6,12}$/.test(ref)) {
      const affiliate = await User.findOne({ 'affiliateProfile.referralCode': ref }).lean();
      if (affiliate) {
        const today = todayStr();
        await Promise.all([
          AffiliateClick.findOneAndUpdate(
            { affiliateId: affiliate._id, date: today },
            { $inc: { clicks: 1 } },
            { upsert: true }
          ),
          User.findByIdAndUpdate(affiliate._id, { $inc: { 'affiliateProfile.totalClicks': 1 } }),
        ]);
      }
    }
    const safePath = /^\/[^/\\]/.test(redirect) || redirect === '/' ? redirect : '/';
    const sep = safePath.includes('?') ? '&' : '?';
    res.redirect(302, `${FRONTEND_URL}${safePath}${sep}aff=${ref || ''}`);
  } catch (err) { next(err); }
}

// New: client-side tracking — frontend calls this after capturing ?aff= from URL
async function recordClick(req, res, next) {
  try {
    const { ref } = req.query;
    if (!ref || !/^[A-Z0-9]{6,12}$/.test(ref)) return res.json({ ok: false });
    const affiliate = await User.findOne({ 'affiliateProfile.referralCode': ref }).lean();
    if (!affiliate) return res.json({ ok: false });
    const today = todayStr();

    const ops = [
      AffiliateClick.findOneAndUpdate(
        { affiliateId: affiliate._id, date: today },
        { $inc: { clicks: 1 } },
        { upsert: true }
      ),
      User.findByIdAndUpdate(affiliate._id, { $inc: { 'affiliateProfile.totalClicks': 1 } }),
    ];

    // If user is logged in, store ref on their profile so order creation can pick it up
    // without relying on localStorage or body params
    if (req.user && req.user._id.toString() !== affiliate._id.toString()) {
      ops.push(User.findByIdAndUpdate(req.user._id, { pendingAffiliateRef: ref }));
    }

    await Promise.all(ops);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const affiliateId = req.user._id;
    const days = last7Days();

    const [orders, referredUsers, clickDocs] = await Promise.all([
      Order.find({ affiliateId }),
      User.countDocuments({ referredBy: affiliateId }),
      AffiliateClick.find({ affiliateId, date: { $in: days } }),
    ]);

    const clicksByDay = {};
    clickDocs.forEach((c) => { clicksByDay[c.date] = c.clicks; });

    const ordersByDay = {};
    orders.forEach((o) => {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      if (days.includes(d)) ordersByDay[d] = (ordersByDay[d] || 0) + 1;
    });

    const weeklyData = days.map((d) => ({
      date: d,
      clicks: clicksByDay[d] || 0,
      conversions: ordersByDay[d] || 0,
    }));

    const totalClicks = req.user.affiliateProfile?.totalClicks || 0;
    const totalSales = orders.length;
    const conversionRate = totalClicks > 0
      ? parseFloat((totalSales / totalClicks * 100).toFixed(2))
      : 0;

    const pendingEarnings = orders
      .filter((o) => !['delivered', 'cancelled', 'returned'].includes(o.status))
      .reduce((sum, o) => sum + (o.affiliateCommission || 0), 0);

    const totalEarnings = orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.affiliateCommission || 0), 0);

    res.json({
      commissionRate: req.user.affiliateProfile?.commissionRate ?? 5,
      referralCode: req.user.affiliateProfile?.referralCode || null,
      totalClicks,
      totalSales,
      conversionRate,
      totalOrders: orders.length,
      pendingEarnings: parseFloat(pendingEarnings.toFixed(2)),
      totalEarnings: parseFloat(totalEarnings.toFixed(2)),
      referredUsers,
      weeklyData,
    });
  } catch (err) { next(err); }
}

async function getOrders(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { affiliateId: req.user._id };
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
}

async function generateCode(req, res, next) {
  try {
    let code;
    let exists = true;
    while (exists) {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      exists = await User.findOne({ 'affiliateProfile.referralCode': code });
    }
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { 'affiliateProfile.referralCode': code },
      { new: true }
    );
    res.json({ referralCode: code, user: updated.toSafeObject() });
  } catch (err) { next(err); }
}

async function submitKyc(req, res, next) {
  try {
    const { panCard, accountHolderName, bankAccount, ifsc, aadhaar } = req.body;
    if (!panCard || !accountHolderName || !bankAccount || !ifsc) {
      throw new AppError('PAN card, account holder name, bank account, and IFSC are required', 400, 'MISSING_FIELDS');
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panCard.toUpperCase().trim())) {
      throw new AppError('Enter a valid PAN card number (e.g. ABCDE1234F)', 400, 'INVALID_PAN');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase().trim())) {
      throw new AppError('Enter a valid IFSC code (e.g. SBIN0001234)', 400, 'INVALID_IFSC');
    }
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        'affiliateProfile.kycStatus': 'pending',
        'affiliateProfile.kycData': {
          panCard: panCard.toUpperCase().trim(),
          accountHolderName: accountHolderName.trim(),
          bankAccount: bankAccount.trim(),
          ifsc: ifsc.toUpperCase().trim(),
          aadhaar: aadhaar?.trim() || '',
        },
      },
      { new: true }
    );
    res.json({ user: updated.toSafeObject() });
  } catch (err) { next(err); }
}

module.exports = { trackClick, recordClick, getStats, getOrders, generateCode, submitKyc };
