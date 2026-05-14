const axios = require('axios');

const BASE_URL = process.env.DELHIVERY_API_URL || 'https://track.delhivery.com';
const TOKEN = process.env.DELHIVERY_TOKEN;

function headers() {
  return {
    Authorization: `Token ${TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function createShipment({ orderId, waybill, name, phone, address, pincode, city, state, weight, cod = false, collectableAmount = 0 }) {
  if (!TOKEN) { console.log('[Delhivery DEV] createShipment skipped (no token)'); return { waybill }; }
  const payload = {
    shipments: [{
      waybill,
      name,
      add: address,
      pin: String(pincode),
      city,
      state,
      country: 'India',
      phone,
      order: orderId,
      payment: cod ? 'COD' : 'Pre-paid',
      'cod_amount': cod ? collectableAmount : 0,
      weight,
      shipment_length: 10,
      shipment_width: 10,
      shipment_height: 10,
    }],
    pickup_location: { name: process.env.DELHIVERY_PICKUP || 'Primary' },
  };

  const res = await axios.post(`${BASE_URL}/api/cmu/create.json`, JSON.stringify(payload), {
    headers: { ...headers(), 'Content-Type': 'application/json' },
  });
  return res.data;
}

async function trackShipment(waybill) {
  if (!TOKEN) { console.log('[Delhivery DEV] trackShipment skipped'); return null; }
  const res = await axios.get(`${BASE_URL}/api/v1/packages/json/?waybill=${waybill}`, { headers: headers() });
  const pkg = res.data?.ShipmentData?.[0]?.Shipment;
  if (!pkg) return null;
  return {
    status: pkg.Status?.Status,
    statusDate: pkg.Status?.StatusDateTime,
    location: pkg.Status?.StatusLocation,
    instructions: pkg.Status?.Instructions,
    history: (pkg.Scans || []).map((s) => ({
      status: s.ScanDetail?.Scan,
      location: s.ScanDetail?.ScannedLocation,
      timestamp: s.ScanDetail?.ScanDateTime,
    })),
  };
}

async function cancelShipment(waybill) {
  if (!TOKEN) { console.log('[Delhivery DEV] cancelShipment skipped'); return {}; }
  const res = await axios.post(`${BASE_URL}/api/p/edit`, { waybill, cancellation: true }, { headers: headers() });
  return res.data;
}

async function checkServiceability(pincode) {
  if (!TOKEN) return { serviceable: true };
  try {
    const res = await axios.get(`${BASE_URL}/c/api/pin-codes/json/?filter_codes=${pincode}`, { headers: headers() });
    const data = res.data?.delivery_codes?.[0]?.postal_code;
    return { serviceable: !!data, cod: data?.cod === 'Y', prepaid: data?.pre_paid === 'Y' };
  } catch {
    return { serviceable: true };
  }
}

module.exports = { createShipment, trackShipment, cancelShipment, checkServiceability };
