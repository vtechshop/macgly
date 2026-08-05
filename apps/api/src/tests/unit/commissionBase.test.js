const { computeCommission, resolveTaxableValue } = require('../../utils/tax');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

describe('resolveTaxableValue (PAY-08)', () => {
  it('prefers the snapshot written at order time', () => {
    expect(resolveTaxableValue({ price: 118, quantity: 1, gstRate: 18, taxableValue: 100 })).toBe(100);
  });

  it('derives from the inclusive line total when no snapshot exists (legacy order)', () => {
    expect(resolveTaxableValue({ price: 118, quantity: 1, gstRate: 18 })).toBeCloseTo(100, 2);
    expect(resolveTaxableValue({ price: 118, quantity: 3, gstRate: 18 })).toBeCloseTo(300, 2);
  });

  it('returns the full line total when the rate is zero (exempt)', () => {
    expect(resolveTaxableValue({ price: 500, quantity: 2, gstRate: 0 })).toBe(1000);
  });

  // Regression guard: dividing by (100+rate) instead of subtracting the rounded
  // GST diverges from splitGst at some rates, which would make a legacy-derived
  // base disagree with a snapshotted one for the identical line.
  it('reproduces exactly what splitGst snapshots, to the paise', () => {
    const { splitGst } = require('../../utils/tax');
    for (const gstRate of [5, 12, 18, 28]) {
      for (const price of [1, 99.99, 1000, 2500, 13333.33]) {
        const snapshot = splitGst({ lineTotal: price, rate: gstRate, supplierStateCode: '33', placeOfSupplyStateCode: '33' });
        expect(resolveTaxableValue({ price, quantity: 1, gstRate })).toBe(snapshot.taxableValue);
      }
    }
  });

  it('ignores a zero or malformed snapshot and derives instead', () => {
    expect(resolveTaxableValue({ price: 118, quantity: 1, gstRate: 18, taxableValue: 0 })).toBeCloseTo(100, 2);
    expect(resolveTaxableValue({ price: 118, quantity: 1, gstRate: 18, taxableValue: null })).toBeCloseTo(100, 2);
    expect(resolveTaxableValue({ price: 118, quantity: 1, gstRate: 18, taxableValue: 'abc' })).toBeCloseTo(100, 2);
  });

  it('never returns NaN for a malformed item', () => {
    expect(Number.isNaN(resolveTaxableValue({}))).toBe(false);
    expect(Number.isNaN(resolveTaxableValue(null))).toBe(false);
  });
});

describe('computeCommission (PAY-08)', () => {
  // The worked example from the brief.
  it('charges 10% on Rs.100 taxable, not on the Rs.118 inclusive price', () => {
    const r = computeCommission({ price: 118, quantity: 1, gstRate: 18, taxableValue: 100 }, 10);
    expect(r.taxableValue).toBe(100);
    expect(r.platformFee).toBe(10);        // was 11.80
    expect(r.vendorEarning).toBe(108);     // was 106.20
    expect(r.lineTotal).toBe(118);
  });

  it.each([
    // rate, inclusive line total, taxable, fee@10%, vendor payout
    [5,  2500, 2380.95, 238.10, 2261.90],
    [12, 2500, 2232.14, 223.21, 2276.79],
    [18, 2500, 2118.64, 211.86, 2288.14],
    [28, 2500, 1953.12, 195.31, 2304.69],
    [0,  2500, 2500.00, 250.00, 2250.00],  // exempt: nothing to strip
  ])('GST %s%%: Rs.%s inclusive -> taxable %s, fee %s, payout %s', (gstRate, price, taxable, fee, payout) => {
    const r = computeCommission({ price, quantity: 1, gstRate }, 10);
    expect(r.taxableValue).toBeCloseTo(taxable, 2);
    expect(r.platformFee).toBeCloseTo(fee, 2);
    expect(r.vendorEarning).toBeCloseTo(payout, 2);
  });

  it('preserves the settlement identity for every rate and quantity', () => {
    for (const gstRate of [0, 5, 12, 18, 28]) {
      for (const commissionRate of [0, 5, 10, 15, 25]) {
        for (const [price, quantity] of [[1, 1], [99.99, 3], [2500, 2], [13333.33, 7]]) {
          const r = computeCommission({ price, quantity, gstRate }, commissionRate);
          // The customer paid lineTotal; it must be fully accounted for.
          expect(round2(r.platformFee + r.vendorEarning)).toBe(r.lineTotal);
          expect(r.platformFee).toBeGreaterThanOrEqual(0);
          expect(r.vendorEarning).toBeLessThanOrEqual(r.lineTotal);
        }
      }
    }
  });

  it('scales with quantity', () => {
    const one = computeCommission({ price: 2500, quantity: 1, gstRate: 18 }, 10);
    const three = computeCommission({ price: 2500, quantity: 3, gstRate: 18 }, 10);
    expect(three.platformFee).toBeCloseTo(one.platformFee * 3, 1);
  });

  it('honours a per-vendor commission rate', () => {
    const base = { price: 118, quantity: 1, gstRate: 18, taxableValue: 100 };
    expect(computeCommission(base, 0).platformFee).toBe(0);
    expect(computeCommission(base, 15).platformFee).toBe(15);
    expect(computeCommission(base, 15).vendorEarning).toBe(103);
  });

  it('takes zero commission when the rate is zero, paying the vendor in full', () => {
    const r = computeCommission({ price: 2500, quantity: 2, gstRate: 18 }, 0);
    expect(r.platformFee).toBe(0);
    expect(r.vendorEarning).toBe(5000);
  });

  it('always charges less than the old inclusive-base formula', () => {
    for (const gstRate of [5, 12, 18, 28]) {
      const r = computeCommission({ price: 2500, quantity: 1, gstRate }, 10);
      const oldFee = round2((2500 * 10) / 100); // previous behaviour
      expect(r.platformFee).toBeLessThan(oldFee);
      // The shortfall is the commission on the GST portion, within a paise of
      // rounding slack (the two sides round at different points).
      expect(Math.abs((oldFee - r.platformFee) - (2500 - r.taxableValue) * 0.1)).toBeLessThanOrEqual(0.01);
    }
  });

  it('is unchanged from the old formula for exempt supplies', () => {
    const r = computeCommission({ price: 2500, quantity: 1, gstRate: 0 }, 10);
    expect(r.platformFee).toBe(250); // identical to old behaviour
  });

  it('handles a mixed-rate basket line by line', () => {
    const basket = [
      { price: 2500, quantity: 1, gstRate: 5 },
      { price: 2500, quantity: 1, gstRate: 18 },
      { price: 1000, quantity: 2, gstRate: 28 },
    ];
    const results = basket.map((i) => computeCommission(i, 10));
    const totalFee = round2(results.reduce((s, r) => s + r.platformFee, 0));
    const totalPaid = round2(results.reduce((s, r) => s + r.lineTotal, 0));
    const totalPayout = round2(results.reduce((s, r) => s + r.vendorEarning, 0));

    expect(totalPaid).toBe(7000);
    expect(round2(totalFee + totalPayout)).toBe(totalPaid);
    expect(results[0].platformFee).not.toBe(results[1].platformFee); // rates differ
  });

  it('never returns NaN for a malformed item', () => {
    const r = computeCommission({}, 10);
    expect(Number.isNaN(r.platformFee)).toBe(false);
    expect(Number.isNaN(r.vendorEarning)).toBe(false);
    expect(r.lineTotal).toBe(0);
  });
});
