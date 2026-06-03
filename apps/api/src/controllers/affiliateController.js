const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const AffiliateClick = require('../models/AffiliateClick');
const AppError = require('../utils/AppError');
const { FRONTEND_URL } = require('../config/env');
const notif = require('../utils/notificationHelper');

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

    // Notify admins of new affiliate KYC submission
    notif.notifyAdminNewAffiliate({
      affiliate: updated.affiliateProfile,
      userEmail: updated.email,
    }).catch(() => {});

    res.json({ user: updated.toSafeObject() });
  } catch (err) { next(err); }
}

// ─── New dashboard stats (spec-compatible, KYC-normalized) ────────────────────
async function getDashboardStats(req, res, next) {
  try {
    const ap  = req.user.affiliateProfile || {};
    const now = new Date();
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const orders = await Order.find({ affiliateId: req.user._id });

    const delivered       = orders.filter((o) => o.status === 'delivered');
    const totalEarnings   = delivered.reduce((s, o) => s + (o.affiliateCommission || 0), 0);
    const pendingEarnings = orders
      .filter((o) => !['delivered', 'cancelled', 'returned'].includes(o.status))
      .reduce((s, o) => s + (o.affiliateCommission || 0), 0);

    const thisMonthDelivered = delivered.filter((o) => new Date(o.createdAt) >= startOfMonth);
    const lastMonthDelivered = delivered.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= startOfLastMonth && d <= endOfLastMonth;
    });

    const thisMonthEarnings = thisMonthDelivered.reduce((s, o) => s + (o.affiliateCommission || 0), 0);
    const lastMonthEarnings = lastMonthDelivered.reduce((s, o) => s + (o.affiliateCommission || 0), 0);
    const earningsChange = lastMonthEarnings > 0
      ? Math.round(((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100)
      : (thisMonthEarnings > 0 ? 100 : 0);

    const totalClicks      = ap.totalClicks || 0;
    const totalConversions = orders.length;
    const conversionRate   = totalClicks > 0 ? parseFloat((totalConversions / totalClicks * 100).toFixed(2)) : 0;

    // Normalize 'verified' → 'approved' for spec compatibility
    const rawKyc   = ap.kycStatus || 'not_submitted';
    const kycStatus = rawKyc === 'verified' ? 'approved' : rawKyc;

    res.json({
      totalClicks,
      totalConversions,
      conversionRate,
      totalEarnings:        parseFloat(totalEarnings.toFixed(2)),
      pendingEarnings:      parseFloat(pendingEarnings.toFixed(2)),
      paidEarnings:         parseFloat((ap.paidEarnings || 0).toFixed(2)),
      thisMonthEarnings:    parseFloat(thisMonthEarnings.toFixed(2)),
      thisMonthConversions: thisMonthDelivered.length,
      earningsChange,
      status:               kycStatus === 'approved' ? 'active' : 'pending',
      kycStatus,
      code:                 ap.referralCode || null,
      commissionPercentage: ap.commissionRate ?? 5,
    });
  } catch (err) { next(err); }
}

// ─── Affiliate link templates (requires approved KYC) ─────────────────────────
async function getLinks(req, res, next) {
  try {
    const ap = req.user.affiliateProfile;
    let code = ap?.referralCode;

    // Auto-generate a code if KYC is approved but none exists yet
    if (!code) {
      let candidate;
      let exists = true;
      while (exists) {
        candidate = crypto.randomBytes(4).toString('hex').toUpperCase();
        exists = await User.findOne({ 'affiliateProfile.referralCode': candidate }).lean();
      }
      await User.findByIdAndUpdate(req.user._id, { 'affiliateProfile.referralCode': candidate });
      code = candidate;
    }
    const base = FRONTEND_URL.replace(/\/$/, '');
    const links = [
      { type: 'homepage',  url: `${base}/?affId=${code}`,                          description: 'Link to the Macgly homepage' },
      { type: 'search',    url: `${base}/products?affId=${code}`,                  description: 'Link to product search' },
      { type: 'category',  url: `${base}/products?category=tools&affId=${code}`,   description: 'Category-specific link' },
      { type: 'product',   url: `${base}/products/[slug]?affId=${code}`,           description: 'Replace [slug] with a product URL slug' },
    ];
    res.json({
      code,
      commissionPercentage: ap.commissionRate ?? 5,
      totalClicks:     ap.totalClicks     || 0,
      totalConversions: ap.totalConversions || 0,
      totalEarnings:   ap.totalEarnings   || 0,
      links,
    });
  } catch (err) { next(err); }
}

// ─── Affiliate KYC ────────────────────────────────────────────────────────────

async function getKYC(req, res, next) {
  try {
    const ap = req.user.affiliateProfile || {};
    const rawStatus = ap.kycStatus || 'not_submitted';
    const kycStatus = rawStatus === 'verified' ? 'approved' : rawStatus;
    res.json({
      kyc: {
        fullName:        ap.kycFullName      || '',
        address:         ap.kycAddress       || '',
        city:            ap.kycCity          || '',
        state:           ap.kycState         || '',
        country:         ap.kycCountry       || '',
        zipCode:         ap.kycZipCode       || '',
        phoneNumber:     ap.kycPhoneNumber   || '',
        idType:          ap.kycIdType        || '',
        idNumber:        ap.kycIdNumber      || '',
        gstNumber:       ap.kycGstNumber     || '',
        gstVerified:     ap.kycGstVerified   || false,
        gstDetails:      ap.kycGstDetails    || null,
        documents:       ap.kycDocuments     || [],
        status:          kycStatus,
        rejectionReason: ap.kycRejectionReason || ap.kycData?.rejectionReason || '',
        verifiedAt:      ap.kycVerifiedAt,
      },
      panNumber:   ap.panNumber || ap.kycData?.panCard || '',
      panVerified: ap.panVerified || false,
      paymentDetails: {
        accountHolderName: ap.bankDetails?.accountHolderName || ap.kycData?.accountHolderName || '',
        bankName:          ap.bankDetails?.bankName          || ap.kycData?.bankName          || '',
        accountNumber:     ap.bankDetails?.accountNumber     || ap.kycData?.bankAccount       || '',
        ifscCode:          ap.bankDetails?.ifscCode          || ap.kycData?.ifsc              || '',
        upiId:             ap.bankDetails?.upiId             || ap.kycData?.upiId             || '',
      },
      status: rawStatus,
    });
  } catch (err) { next(err); }
}

async function updateKYC(req, res, next) {
  try {
    const {
      fullName, address, city, state, country, zipCode, phoneNumber,
      idType, idNumber, gstNumber, gstVerified, gstDetails, submit,
    } = req.body;

    if (submit) {
      const user = await User.findById(req.user._id).select('affiliateProfile').lean();
      const ap   = user?.affiliateProfile || {};
      const docs = ap.kycDocuments || [];
      const bd   = ap.bankDetails  || {};

      const missing = [];
      if (!(fullName    || ap.kycFullName))    missing.push('Full Name');
      if (!(phoneNumber || ap.kycPhoneNumber)) missing.push('Phone Number');
      if (!(idType      || ap.kycIdType))      missing.push('ID Type');
      if (!(idNumber    || ap.kycIdNumber))    missing.push('ID Number');
      if (!(address     || ap.kycAddress))     missing.push('Address');
      if (!(city        || ap.kycCity))        missing.push('City');
      if (!(state       || ap.kycState))       missing.push('State');
      if (!(country     || ap.kycCountry))     missing.push('Country');
      if (!(bd.accountNumber || ap.kycData?.bankAccount)) missing.push('Bank Account Number');
      if (!(bd.ifscCode      || ap.kycData?.ifsc))        missing.push('IFSC Code');
      if (!(ap.panNumber     || ap.kycData?.panCard))     missing.push('PAN Number');
      if (!docs.some((d) => d.type === 'id_proof'))       missing.push('ID Proof Document');
      if (missing.length) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_REQUIRED_FIELDS', message: `Please complete: ${missing.join(', ')}` } });
      }
    }

    const update = {};
    if (fullName      !== undefined) update['affiliateProfile.kycFullName']    = fullName.trim();
    if (address       !== undefined) update['affiliateProfile.kycAddress']     = address.trim();
    if (city          !== undefined) update['affiliateProfile.kycCity']        = city.trim();
    if (state         !== undefined) update['affiliateProfile.kycState']       = state.trim();
    if (country       !== undefined) update['affiliateProfile.kycCountry']     = country.trim();
    if (zipCode       !== undefined) update['affiliateProfile.kycZipCode']     = zipCode.trim();
    if (phoneNumber   !== undefined) update['affiliateProfile.kycPhoneNumber'] = phoneNumber.trim();
    if (idType        !== undefined) update['affiliateProfile.kycIdType']      = idType;
    if (idNumber      !== undefined) update['affiliateProfile.kycIdNumber']    = idNumber.trim();
    if (gstNumber     !== undefined) update['affiliateProfile.kycGstNumber']   = gstNumber?.toUpperCase().trim() || '';
    if (gstVerified   !== undefined) update['affiliateProfile.kycGstVerified'] = gstVerified;
    if (gstDetails    !== undefined) update['affiliateProfile.kycGstDetails']  = gstDetails;
    if (submit) {
      update['affiliateProfile.kycStatus'] = 'pending';
    } else {
      // Reset rejected status on any save
      const cur = await User.findById(req.user._id).select('affiliateProfile.kycStatus').lean();
      if (cur?.affiliateProfile?.kycStatus === 'rejected') {
        update['affiliateProfile.kycStatus']           = 'pending';
        update['affiliateProfile.kycRejectionReason']  = '';
      }
    }

    await User.findByIdAndUpdate(req.user._id, { $set: update });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function uploadKYCDocument(req, res, next) {
  try {
    const { type, url, filename } = req.body;
    if (!['id_proof', 'address_proof', 'tax_document', 'other'].includes(type)) {
      throw new AppError('Valid document type required', 400, 'INVALID_TYPE');
    }
    if (!url) throw new AppError('Document URL required', 400, 'MISSING_URL');
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { 'affiliateProfile.kycDocuments': { type, url, filename: filename || url.split('/').pop(), uploadedAt: new Date() } } },
      { new: true }
    );
    // Reset rejected status when new doc uploaded
    if (updated.affiliateProfile?.kycStatus === 'rejected') {
      await User.findByIdAndUpdate(req.user._id, { $set: { 'affiliateProfile.kycStatus': 'pending', 'affiliateProfile.kycRejectionReason': '' } });
    }
    const docs = updated.affiliateProfile?.kycDocuments || [];
    res.json({ success: true, document: docs[docs.length - 1] });
  } catch (err) { next(err); }
}

async function deleteKYCDocument(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { 'affiliateProfile.kycDocuments': { _id: req.params.documentId } },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function updatePaymentDetails(req, res, next) {
  try {
    const { paymentDetails, panNumber } = req.body;
    const update = {};
    if (paymentDetails) {
      const { accountHolderName, bankName, accountNumber, ifscCode, upiId } = paymentDetails;
      if (accountHolderName !== undefined) update['affiliateProfile.bankDetails.accountHolderName'] = accountHolderName.trim();
      if (bankName          !== undefined) update['affiliateProfile.bankDetails.bankName']           = bankName.trim();
      if (accountNumber     !== undefined) {
        update['affiliateProfile.bankDetails.accountNumber']  = accountNumber.trim();
        update['affiliateProfile.bankDetails.lastFourDigits'] = accountNumber.trim().slice(-4);
      }
      if (ifscCode !== undefined) update['affiliateProfile.bankDetails.ifscCode'] = ifscCode.toUpperCase().trim();
      if (upiId    !== undefined) update['affiliateProfile.bankDetails.upiId']    = upiId.trim();
    }
    if (panNumber !== undefined) update['affiliateProfile.panNumber'] = panNumber.toUpperCase().trim();
    await User.findByIdAndUpdate(req.user._id, { $set: update });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── Commission helpers ───────────────────────────────────────────────────────

function normCommission(c) {
  const obj    = typeof c.toObject === 'function' ? c.toObject() : c;
  const amount = obj.commissionAmount ?? obj.amount ?? 0;
  const tdsAmt = obj.tds?.amount  ?? (obj.status === 'paid' ? parseFloat((amount * 0.02).toFixed(2)) : 0);
  const netAmt = obj.tds?.netAmount ?? (obj.status === 'paid' ? parseFloat((amount - tdsAmt).toFixed(2)) : amount);
  return {
    ...obj,
    orderId:     obj.order?.orderId     || '',
    orderAmount: obj.order?.totalAmount || obj.saleAmount || 0,
    amount,
    percentage:  obj.commissionRate     || 0,
    tds: { amount: tdsAmt, netAmount: netAmt },
  };
}

// ─── GET /affiliates/commissions/stats ────────────────────────────────────────
async function getCommissionStats(req, res, next) {
  try {
    const Commission = require('../models/Commission');
    const filter = { user: req.user._id, type: 'affiliate' };
    const now  = new Date();
    const som  = new Date(now.getFullYear(), now.getMonth(), 1);
    const solm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const eolm = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const soq  = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const [pend, appr, pd, thisM, lastM, thisQ] = await Promise.all([
      Commission.aggregate([{ $match: { ...filter, status: 'pending'  } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$commissionAmount' } } }]),
      Commission.aggregate([{ $match: { ...filter, status: 'approved' } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$commissionAmount' } } }]),
      Commission.aggregate([{ $match: { ...filter, status: 'paid'     } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$commissionAmount' }, tds: { $sum: { $multiply: ['$commissionAmount', 0.02] } } } }]),
      Commission.aggregate([{ $match: { ...filter, createdAt: { $gte: som  } } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$commissionAmount' } } }]),
      Commission.aggregate([{ $match: { ...filter, createdAt: { $gte: solm, $lte: eolm } } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$commissionAmount' } } }]),
      Commission.aggregate([{ $match: { ...filter, createdAt: { $gte: soq  } } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$commissionAmount' } } }]),
    ]);

    const ap = req.user.affiliateProfile || {};
    const thisMonthAmt  = thisM[0]?.amount  || 0;
    const lastMonthAmt  = lastM[0]?.amount  || 0;
    const change = lastMonthAmt > 0 ? Math.round(((thisMonthAmt - lastMonthAmt) / lastMonthAmt) * 100) : 0;

    res.json({
      pending:      { count: pend[0]?.count  || 0, amount: pend[0]?.amount  || 0 },
      approved:     { count: appr[0]?.count  || 0, amount: appr[0]?.amount  || 0 },
      paid: {
        count:     pd[0]?.count   || 0,
        amount:    pd[0]?.amount  || 0,
        tdsAmount: parseFloat(((pd[0]?.tds || 0)).toFixed(2)),
        netAmount: parseFloat(((pd[0]?.amount || 0) - (pd[0]?.tds || 0)).toFixed(2)),
      },
      thisMonth:    { count: thisM[0]?.count  || 0, amount: thisMonthAmt, change },
      lastMonth:    { count: lastM[0]?.count  || 0, amount: lastMonthAmt },
      thisQuarter:  { count: thisQ[0]?.count  || 0, amount: thisQ[0]?.amount  || 0 },
      commissionPercentage: ap.commissionRate ?? 5,
      tierLevel: 'bronze',
    });
  } catch (err) { next(err); }
}

// ─── GET /affiliates/commissions ──────────────────────────────────────────────
async function getCommissions(req, res, next) {
  try {
    const Commission = require('../models/Commission');
    const { page = 1, limit = 20, status, dateRange } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { user: req.user._id, type: 'affiliate' };
    if (status) filter.status = status;

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const starts = {
        today:   new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        week:    new Date(Date.now() - 7 * 86400000),
        month:   new Date(now.getFullYear(), now.getMonth(), 1),
        quarter: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
      };
      if (starts[dateRange]) filter.createdAt = { $gte: starts[dateRange] };
    }

    const [commissions, total] = await Promise.all([
      Commission.find(filter)
        .populate('order', 'orderId totalAmount createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Commission.countDocuments(filter),
    ]);

    res.json({
      data: commissions.map(normCommission),
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
}

async function getProductStats(req, res, next) {
  try {
    const ap = req.user.affiliateProfile || {};
    // Stub — Commission model aggregations reserved for future implementation
    res.json({
      topSelling:         [],
      topEarning:         [],
      recentConversions:  [],
      categoryStats:      [],
      commissionPercentage: ap.commissionRate ?? 5,
    });
  } catch (err) { next(err); }
}

// ─── GET /affiliates/me ───────────────────────────────────────────────────────

async function getAffiliateProfile(req, res, next) {
  try {
    const ap = req.user.affiliateProfile || {};
    const rawKyc   = ap.kycStatus || 'not_submitted';
    const kycStatus = rawKyc === 'verified' ? 'approved' : rawKyc;

    const orders          = await Order.find({ affiliateId: req.user._id });
    const delivered       = orders.filter((o) => o.status === 'delivered');
    const totalEarnings   = delivered.reduce((s, o) => s + (o.affiliateCommission || 0), 0);
    const pendingEarnings = orders
      .filter((o) => !['delivered', 'cancelled', 'returned'].includes(o.status))
      .reduce((s, o) => s + (o.affiliateCommission || 0), 0);

    res.json({
      code:                 ap.referralCode || null,
      status:               kycStatus === 'approved' ? 'active' : 'pending',
      kyc:                  { status: kycStatus },
      commissionPercentage: ap.commissionRate ?? 5,
      totalClicks:          ap.totalClicks || 0,
      totalConversions:     orders.length,
      totalEarnings:        parseFloat(totalEarnings.toFixed(2)),
      pendingEarnings:      parseFloat(pendingEarnings.toFixed(2)),
      paidEarnings:         parseFloat((ap.paidEarnings || 0).toFixed(2)),
      createdAt:            req.user.createdAt,
      razorpay:             { accountStatus: 'not_connected', settlementSchedule: null },
    });
  } catch (err) { next(err); }
}

// ─── GET /affiliates/preferences ──────────────────────────────────────────────

async function getPreferences(req, res, next) {
  try {
    const ap = req.user.affiliateProfile || {};
    const defaults = {
      emailNotifications: true, showEarnings: true, soundEnabled: true,
      weeklyReports: true, monthlyReports: true, promotionalEmails: false,
      currency: 'INR', language: 'en',
    };
    res.json({ ...defaults, ...(ap.preferences || {}) });
  } catch (err) { next(err); }
}

// ─── PUT /affiliates/preferences ──────────────────────────────────────────────

async function updatePreferences(req, res, next) {
  try {
    const allowed = ['emailNotifications', 'showEarnings', 'soundEnabled', 'weeklyReports', 'monthlyReports', 'promotionalEmails', 'currency', 'language'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[`affiliateProfile.preferences.${key}`] = req.body[key];
      }
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: { message: 'No valid preference fields provided' } });
    }
    await User.findByIdAndUpdate(req.user._id, { $set: update });
    res.json({ message: 'Preferences updated successfully' });
  } catch (err) { next(err); }
}

module.exports = {
  trackClick, recordClick, getStats, getOrders, generateCode, submitKyc,
  getDashboardStats, getLinks, getProductStats,
  getCommissions, getCommissionStats,
  getKYC, updateKYC, uploadKYCDocument, deleteKYCDocument, updatePaymentDetails,
  getAffiliateProfile, getPreferences, updatePreferences,
};
