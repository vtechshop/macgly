const axios = require('axios');
const { DELHIVERY_API_KEY, DELHIVERY_BASE_URL } = require('../../config/env');

class DelhiveryAdapter {
  constructor() {
    this.client = axios.create({
      baseURL: DELHIVERY_BASE_URL,
      headers: { Authorization: `Token ${DELHIVERY_API_KEY}` },
    });
  }

  async createShipment({ order, waybill }) {
    const body = {
      format: 'json',
      data: JSON.stringify({
        shipments: [{
          name: order.shippingAddress.name,
          add: order.shippingAddress.line1,
          pin: order.shippingAddress.pincode,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          country: 'India',
          phone: order.shippingAddress.phone,
          order: order.orderId,
          payment_mode: order.paymentStatus === 'paid' ? 'Prepaid' : 'COD',
          cod_amount: order.paymentStatus !== 'paid' ? order.totalAmount : 0,
          waybill,
        }],
      }),
    };
    const { data } = await this.client.post('/api/cmu/create.json', new URLSearchParams(body));
    return { trackingId: waybill, carrier: 'delhivery', url: `https://www.delhivery.com/track/package/${waybill}` };
  }

  async trackShipment(trackingId) {
    const { data } = await this.client.get(`/api/v1/packages/json/?waybill=${trackingId}`);
    const pkg = data?.ShipmentData?.[0]?.Shipment;
    return {
      trackingId,
      status: pkg?.Status?.Status || 'unknown',
      history: (pkg?.Scans || []).map((s) => ({
        status: s.ScanDetail?.Scan,
        timestamp: new Date(s.ScanDetail?.ScanDateTime),
        description: s.ScanDetail?.Instructions,
      })),
    };
  }

  async checkServiceability({ pincode, weight = 0.5 }) {
    const { data } = await this.client.get(`/c/api/pin-codes/json/?filter_codes=${pincode}`);
    return {
      serviceable: data?.delivery_codes?.length > 0,
      estimatedDays: 4,
    };
  }

  async calculateRate({ weight, from, to }) {
    const { data } = await this.client.get(
      `/api/kinko/v1/invoice/charges/.json?md=S&cgm=${weight * 1000}&o_pin=${from}&d_pin=${to}&pt=Pre-paid`
    );
    return { rate: data?.[0]?.total_amount || weight * 50, currency: 'INR' };
  }
}

module.exports = DelhiveryAdapter;
