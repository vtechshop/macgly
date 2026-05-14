const Razorpay = require('razorpay');
const Commission = require('../models/Commission');

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

async function createFundAccount(user) {
  if (!process.env.RAZORPAY_KEY_ID) return null;
  const rz = getRazorpay();
  // Create contact first
  const contact = await rz.contacts.create({
    name: user.name,
    email: user.email,
    contact: user.phone || '',
    type: user.role === 'vendor' ? 'vendor' : 'employee',
  });
  // Create fund account
  const fundAccount = await rz.fundAccount.create({
    contact_id: contact.id,
    account_type: 'bank_account',
    bank_account: {
      name: user.vendorProfile?.accountHolderName || user.name,
      ifsc: user.vendorProfile?.ifsc,
      account_number: user.vendorProfile?.bankAccount,
    },
  });
  return fundAccount.id;
}

async function initiatePayout(commissionId) {
  const commission = await Commission.findById(commissionId).populate('user');
  if (!commission) throw new Error('Commission not found');
  if (commission.status !== 'approved') throw new Error('Commission must be approved before payout');

  if (!process.env.RAZORPAY_KEY_ID) {
    console.log(`[Payout DEV] Would pay ₹${commission.commissionAmount} to ${commission.user.email}`);
    await Commission.findByIdAndUpdate(commissionId, { status: 'paid', paidAt: new Date(), payoutId: 'DEV-' + Date.now() });
    return { status: 'simulated' };
  }

  const rz = getRazorpay();
  const fundAccountId = commission.user.vendorProfile?.razorpayFundAccountId;
  if (!fundAccountId) throw new Error('No fund account on file — vendor must complete KYC payout setup');

  const payout = await rz.payouts.create({
    account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
    fund_account_id: fundAccountId,
    amount: Math.round(commission.commissionAmount * 100), // paise
    currency: 'INR',
    mode: 'IMPS',
    purpose: 'payout',
    narration: `Macgly commission ${commission._id}`,
  });

  await Commission.findByIdAndUpdate(commissionId, {
    status: 'paid',
    paidAt: new Date(),
    payoutId: payout.id,
  });

  return payout;
}

async function bulkPayout(commissionIds) {
  const results = [];
  for (const id of commissionIds) {
    try {
      const result = await initiatePayout(id);
      results.push({ id, success: true, result });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }
  return results;
}

module.exports = { createFundAccount, initiatePayout, bulkPayout };
