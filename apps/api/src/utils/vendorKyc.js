// What a vendor must have on file before an admin may approve them. Used by
// both approve routes (Admin → Vendors and Admin → KYC Review) so a vendor can
// never be approved — or told they are — before their KYC is complete.
//
// GSTIN is optional (sellers under the ₹40 lakh turnover threshold need not
// register), so GST verification is required only when a GSTIN was given.

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
  if (vp.gstin?.trim()) checks.push(['GST verification', vp.gstVerified]);
  return checks.filter(([, ok]) => !ok).map(([label]) => label);
}

module.exports = { vendorKycGaps };
