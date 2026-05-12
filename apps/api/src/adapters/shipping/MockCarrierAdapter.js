class MockCarrierAdapter {
  async createShipment({ order }) {
    return {
      trackingId: `MOCK-${Date.now()}`,
      carrier: 'mock',
      url: '#',
      estimatedDays: 3,
    };
  }

  async trackShipment(trackingId) {
    return {
      trackingId,
      status: 'in_transit',
      history: [
        { status: 'picked_up', timestamp: new Date(), description: 'Picked up from seller' },
        { status: 'in_transit', timestamp: new Date(), description: 'In transit to destination' },
      ],
    };
  }

  async checkServiceability({ pincode }) {
    return { serviceable: true, estimatedDays: 3 };
  }

  async calculateRate({ weight, from, to }) {
    return { rate: weight * 40, currency: 'INR' };
  }
}

module.exports = MockCarrierAdapter;
