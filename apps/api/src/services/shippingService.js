const DelhiveryAdapter = require('../adapters/shipping/DelhiveryAdapter');
const ShiprocketAdapter = require('../adapters/shipping/ShiprocketAdapter');
const MockCarrierAdapter = require('../adapters/shipping/MockCarrierAdapter');
const { DELHIVERY_API_KEY, SHIPROCKET_EMAIL, isProd } = require('../config/env');

function getAdapter(carrier = 'auto') {
  if (carrier === 'shiprocket' && SHIPROCKET_EMAIL) return new ShiprocketAdapter();
  if (carrier === 'delhivery' && DELHIVERY_API_KEY) return new DelhiveryAdapter();
  if (carrier === 'auto') {
    if (SHIPROCKET_EMAIL) return new ShiprocketAdapter();
    if (DELHIVERY_API_KEY) return new DelhiveryAdapter();
  }
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
