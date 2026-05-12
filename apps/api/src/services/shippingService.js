const DelhiveryAdapter = require('../adapters/shipping/DelhiveryAdapter');
const MockCarrierAdapter = require('../adapters/shipping/MockCarrierAdapter');
const { DELHIVERY_API_KEY, isProd } = require('../config/env');

function getAdapter(carrier = 'auto') {
  if (!DELHIVERY_API_KEY || !isProd()) return new MockCarrierAdapter();
  if (carrier === 'delhivery' || carrier === 'auto') return new DelhiveryAdapter();
  return new MockCarrierAdapter();
}

async function createShipment({ order, carrier = 'auto', waybill }) {
  const adapter = getAdapter(carrier);
  return adapter.createShipment({ order, waybill });
}

async function trackShipment(trackingId, carrier = 'delhivery') {
  const adapter = getAdapter(carrier);
  return adapter.trackShipment(trackingId);
}

async function checkServiceability({ pincode, carrier = 'auto' }) {
  const adapter = getAdapter(carrier);
  return adapter.checkServiceability({ pincode });
}

async function calculateShippingRate({ weight, fromPincode, toPincode, carrier = 'auto' }) {
  const adapter = getAdapter(carrier);
  return adapter.calculateRate({ weight, from: fromPincode, to: toPincode });
}

module.exports = { createShipment, trackShipment, checkServiceability, calculateShippingRate };
