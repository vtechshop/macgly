const axios = require('axios');
const { DELHIVERY_API_KEY, DELHIVERY_BASE_URL, DELHIVERY_PICKUP_PINCODE } = require('../../config/env');

const SELLER = {
  name:    'Macgly',
  add:     '9/83, E, 4th Street, T.Balan Nagar, Ganapathipudur',
  pin:     DELHIVERY_PICKUP_PINCODE || '641006',
  city:    'Coimbatore',
  state:   'Tamil Nadu',
  country: 'India',
  phone:   '9944556683',
};

class DelhiveryAdapter {
  constructor() {
    this.client = axios.create({
      baseURL: DELHIVERY_BASE_URL,
      headers: { Authorization: `Token ${DELHIVERY_API_KEY}` },
    });
  }

  async createShipment({ order, waybill }) {
    // Calculate weight in grams — use order weight if available, else estimate from items
    const weightKg = order.items?.reduce((sum, i) => sum + ((i.weight || 0.3) * (i.quantity || 1)), 0) || 0.5;
    const weightGrams = Math.round(weightKg * 1000);

    const shipmentData = {
      shipments: [{
        waybill:           waybill || '',           // empty = Delhivery auto-assigns AWB
        name:              order.shippingAddress.name,
        add:               [order.shippingAddress.line1, order.shippingAddress.line2].filter(Boolean).join(', '),
        pin:               order.shippingAddress.pincode,
        city:              order.shippingAddress.city,
        state:             order.shippingAddress.state,
        country:           'India',
        phone:             order.shippingAddress.phone,
        order:             order.orderId,
        payment_mode:      order.paymentStatus === 'paid' ? 'Prepaid' : 'COD',
        cod_amount:        order.paymentStatus !== 'paid' ? order.totalAmount : 0,
        total_amount:      order.totalAmount,
        weight:            weightGrams,
        shipment_length:   15,
        shipment_breadth:  10,
        shipment_height:   10,
        // Return / seller info
        return_pin:        SELLER.pin,
        return_city:       SELLER.city,
        return_state:      SELLER.state,
        return_country:    SELLER.country,
        return_add:        SELLER.add,
        return_name:       SELLER.name,
        return_phone:      SELLER.phone,
        seller_name:       SELLER.name,
        seller_add:        SELLER.add,
        seller_pin:        SELLER.pin,
        seller_city:       SELLER.city,
        seller_state:      SELLER.state,
        seller_country:    SELLER.country,
      }],
    };

    const body = new URLSearchParams({
      format: 'json',
      data:   JSON.stringify(shipmentData),
    });

    const { data } = await this.client.post('/api/cmu/create.json', body);

    // Delhivery returns packages array with the auto-assigned waybill
    const pkg = data?.packages?.[0];
    if (pkg && pkg.status !== 'Success') {
      throw new Error(`Delhivery shipment failed: ${pkg.remarks?.join(', ') || 'unknown error'}`);
    }

    const assignedWaybill = pkg?.waybill || waybill || '';
    return {
      trackingId: assignedWaybill,
      carrier:    'Delhivery',
      url:        assignedWaybill ? `https://www.delhivery.com/track/package/${assignedWaybill}` : '',
    };
  }

  async trackShipment(trackingId) {
    const { data } = await this.client.get(`/api/v1/packages/json/?waybill=${trackingId}`);
    const pkg = data?.ShipmentData?.[0]?.Shipment;
    return {
      trackingId,
      status: pkg?.Status?.Status || 'unknown',
      statusDate: pkg?.Status?.StatusDateTime,
      location: pkg?.Status?.StatusLocation,
      history: (pkg?.Scans || []).map((s) => ({
        status:      s.ScanDetail?.Scan,
        timestamp:   new Date(s.ScanDetail?.ScanDateTime),
        description: s.ScanDetail?.Instructions,
      })),
    };
  }

  async checkServiceability({ pincode }) {
    const { data } = await this.client.get(`/c/api/pin-codes/json/?filter_codes=${pincode}`);
    return {
      serviceable:   data?.delivery_codes?.length > 0,
      estimatedDays: 4,
    };
  }

  async calculateRate({ weight, from, to }) {
    const { data } = await this.client.get(
      `/api/kinko/v1/invoice/charges/.json?md=S&cgm=${Math.round(weight * 1000)}&o_pin=${from}&d_pin=${to}&pt=Pre-paid&ss=Delivered`
    );
    return { rate: data?.[0]?.total_amount || weight * 50, currency: 'INR' };
  }
}

module.exports = DelhiveryAdapter;
