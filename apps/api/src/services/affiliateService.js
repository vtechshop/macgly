const User = require('../models/User');
const AffiliateClick = require('../models/AffiliateClick');

async function resolveAffiliate(referralCode) {
  if (!referralCode) return null;
  const user = await User.findOne({ 'affiliateProfile.referralCode': referralCode.toUpperCase(), role: 'affiliate' });
  return user || null;
}

async function recordClick(referralCode, ipAddress, userAgent, productId) {
  const affiliate = await resolveAffiliate(referralCode);
  if (!affiliate) return null;
  await AffiliateClick.create({
    affiliate: affiliate._id,
    referralCode,
    ipAddress,
    userAgent,
    product: productId || null,
  });
  await User.findByIdAndUpdate(affiliate._id, { $inc: { 'affiliateProfile.totalClicks': 1 } });
  return affiliate;
}

async function getStats(affiliateId) {
  const Commission = require('../models/Commission');
  const [clicks, commissions] = await Promise.all([
    AffiliateClick.countDocuments({ affiliate: affiliateId }),
    Commission.find({ user: affiliateId, type: 'affiliate' }),
  ]);
  const totalEarnings = commissions.reduce((s, c) => s + c.commissionAmount, 0);
  const pendingEarnings = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + c.commissionAmount, 0);
  const paidEarnings = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + c.commissionAmount, 0);
  const conversions = commissions.length;
  return { clicks, conversions, totalEarnings, pendingEarnings, paidEarnings };
}

module.exports = { resolveAffiliate, recordClick, getStats };
