// What a vendor must have on file before an admin may approve them. Used by
// both approve routes (Admin → Vendors and Admin → KYC Review) so a vendor can
// never be approved — or told they are — before their KYC is complete.
//
// GSTIN is optional (sellers under the ₹40 lakh turnover threshold need not
// register). When one is given it must be well-formed; there is no automatic
// verification provider, so the admin checks it on the GST portal and
// approving KYC is what marks it verified (see approvalUpdate).

const { isValidGstinFormat } = require('./gstin');

function vendorKycGaps(vp = {}) {
  const docs = vp.kycDocuments || [];
  const checks = [
    ['business name',          vp.businessName?.trim()],
    ['business type',          vp.businessType],
    ['business address',       vp.businessAddress?.trim()],
    ['business phone',         vp.businessPhone?.trim()],
    ['PAN',                    vp.panCard?.trim()],
    ['bank account details',   vp.bankAccount?.trim() && vp.ifsc?.trim() && vp.accountHolderName?.trim()],
    ['ID proof document',      docs.some((d) => d.type === 'id_proof')],
    ['address proof document', docs.some((d) => d.type === 'address_proof')],
  ];
  if (vp.gstin?.trim()) checks.push(['a valid GSTIN', isValidGstinFormat(vp.gstin)]);
  return checks.filter(([, ok]) => !ok).map(([label]) => label);
}

/** Fields every approve route sets. The admin has checked the GSTIN, if any. */
function approvalUpdate(vp = {}, adminId) {
  return {
    'vendorProfile.approved': true,
    'vendorProfile.rejectionReason': '',
    'vendorProfile.kycStatus': 'approved',
    'vendorProfile.kycVerifiedAt': new Date(),
    'vendorProfile.kycVerifiedBy': adminId,
    ...(vp.gstin?.trim() ? { 'vendorProfile.gstVerified': true } : {}),
  };
}

module.exports = { vendorKycGaps, approvalUpdate };
