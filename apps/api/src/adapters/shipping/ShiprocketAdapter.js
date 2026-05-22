const axios = require('axios');
const { SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD } = require('../../config/env');

const BASE = 'https://apiv2.shiprocket.in/v1/external';

class ShiprocketAdapter {
  constructor() {
    this._token = null;
    this._tokenExpiry = 0;
  }

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiry) return this._token;
    const { data } = await axios.post(`${BASE}/auth/login`, {
      email: SHIPROCKET_EMAIL,
      password: SHIPROCKET_PASSWORD,
    });
    this._token = data.token;
    this._tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000; // tokens last 10 days
    return this._token;
  }

  async _client() {
    const token = await this._getToken();
    return axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${token}` } });
  }

  async createShipment({ order }) {
    const client = await this._client();
    const addr = order.shippingAddress || {};
    const orderPayload = {
      order_id: order.orderId,
      order_date: order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      pickup_location: 'Primary',
      billing_customer_name: addr.name || order.user?.name || 'Customer',
      billing_address: addr.line1 || addr.address || '',
      billing_address_2: addr.line2 || '',
      billing_city: addr.city || '',
      billing_pincode: addr.pincode || '',
      billing_state: addr.state || '',
      billing_country: 'India',
      billing_email: order.user?.email || '',
      billing_phone: addr.phone || order.user?.phone || '',
      shipping_is_billing: true,
      order_items: (order.items || []).map((item) => ({
        name: item.title || 'Product',
        sku: item.sku || item.product?.toString() || 'SKU',
        units: item.quantity,
        selling_price: item.price,
      })),
      payment_method: order.paymentStatus === 'paid' ? 'Prepaid' : 'COD',
      sub_total: order.totalAmount,
      length: 10, breadth: 10, height: 10, weight: 0.5,
    };
    const { data } = await client.post('/orders/create/adhoc', orderPayload);
    const shipmentId = data?.payload?.shipment_id;
    const awbCode = data?.payload?.awb_code;
    return {
      trackingId: awbCode || shipmentId?.toString(),
      carrier: 'shiprocket',
      url: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null,
      raw: data,
    };
  }

  async trackShipment(trackingId) {
    const client = await this._client();
    const { data } = await client.get(`/courier/track/awb/${trackingId}`);
    const info = data?.tracking_data;
    return {
      trackingId,
      status: info?.shipment_status || 'unknown',
      history: (info?.shipment_track_activities || []).map((a) => ({
        status: a['sr-status-label'] || a.activity,
        timestamp: new Date(a.date),
        description: a.location || '',
      })),
    };
  }

  async checkServiceability({ pincode, weight = 0.5 }) {
    const client = await this._client();
    try {
      const { data } = await client.get(`/courier/serviceability/?pickup_postcode=110001&delivery_postcode=${pincode}&cod=1&weight=${weight}`);
      const couriers = data?.data?.available_courier_companies || [];
      return { serviceable: couriers.length > 0, estimatedDays: couriers[0]?.estimated_delivery_days || 5 };
    } catch {
      return { serviceable: true, estimatedDays: 5 };
    }
  }

  async calculateRate({ weight, from, to }) {
    try {
      const client = await this._client();
      const { data } = await client.get(`/courier/serviceability/?pickup_postcode=${from}&delivery_postcode=${to}&cod=1&weight=${weight}`);
      const cheapest = (data?.data?.available_courier_companies || []).sort((a, b) => a.rate - b.rate)[0];
      return { rate: cheapest?.rate || weight * 60, currency: 'INR', courier: cheapest?.courier_name };
    } catch {
      return { rate: weight * 60, currency: 'INR' };
    }
  }
}

module.exports = ShiprocketAdapter;
