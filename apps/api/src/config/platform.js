const { PLATFORM_GST_STATE_CODE } = require('./env');

/**
 * The platform's own legal identity as a supplier.
 *
 * Needed because a tax invoice must name the supplier with an address and GSTIN,
 * and none of that existed anywhere — the only trace was a hardcoded address
 * inside adapters/shipping/DelhiveryAdapter.js. Defaults mirror that address.
 *
 * PLATFORM_GSTIN has NO default on purpose. Inventing a registration number
 * would fabricate a tax position; an empty value renders as blank on the
 * invoice, which is visibly wrong and therefore gets fixed.
 */
const PLATFORM_PARTY = {
  legalName: process.env.PLATFORM_LEGAL_NAME || 'Macgly',
  tradeName: process.env.PLATFORM_TRADE_NAME || 'Macgly',
  gstin:     process.env.PLATFORM_GSTIN || '',
  pan:       process.env.PLATFORM_PAN || '',
  stateCode: PLATFORM_GST_STATE_CODE,
  email:     process.env.PLATFORM_EMAIL || 'support@macgly.com',
  phone:     process.env.PLATFORM_PHONE || '9944556683',
  address: {
    line1:   process.env.PLATFORM_ADDR_LINE1 || '9/83, E, 4th Street, T.Balan Nagar',
    line2:   process.env.PLATFORM_ADDR_LINE2 || 'Ganapathipudur',
    city:    process.env.PLATFORM_ADDR_CITY || 'Coimbatore',
    state:   process.env.PLATFORM_ADDR_STATE || 'Tamil Nadu',
    pincode: process.env.PLATFORM_ADDR_PINCODE || '641006',
    country: 'India',
  },
};

module.exports = { PLATFORM_PARTY };
