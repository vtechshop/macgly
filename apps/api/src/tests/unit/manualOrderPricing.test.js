const {
  resolveManualPrice, assertFeeCoveredBySale, clampDiscount, assertAmountPaidMatches,
} = require('../../utils/manualOrderPricing');
const { computeCommission } = require('../../utils/tax');

const product = (price) => ({ price, title: 'Angle Grinder' });

describe('resolveManualPrice (MAN-PRICE-01)', () => {
  it('uses the catalogue price when none is declared', () => {
    for (const declared of [undefined, null, '']) {
      expect(resolveManualPrice(declared, product(2500), 'x'))
        .toEqual({ sellingPrice: 2500, listPrice: 2500 });
    }
  });

  it('always reports the catalogue price as listPrice, whatever is declared', () => {
    expect(resolveManualPrice(100, product(2500), 'x')).toEqual({ sellingPrice: 100, listPrice: 2500 });
    expect(resolveManualPrice(9999, product(2500), 'x')).toEqual({ sellingPrice: 9999, listPrice: 2500 });
  });

  it('accepts a legitimate counter discount', () => {
    expect(resolveManualPrice(2250, product(2500), 'x').sellingPrice).toBe(2250);
  });

  it('accepts zero — a giveaway is a real counter scenario', () => {
    expect(resolveManualPrice(0, product(2500), 'x').sellingPrice).toBe(0);
  });

  it('coerces a numeric string, as the form sends it', () => {
    expect(resolveManualPrice('2250.50', product(2500), 'x').sellingPrice).toBe(2250.5);
  });

  it.each([-1, -0.01, 'free', NaN, Infinity, {}, []])('rejects %p', (bad) => {
    expect(() => resolveManualPrice(bad, product(2500), 'Grinder')).toThrow(/Invalid price for Grinder/);
  });

  it('treats a missing catalogue price as zero rather than NaN', () => {
    expect(resolveManualPrice(undefined, {}, 'x')).toEqual({ sellingPrice: 0, listPrice: 0 });
  });
});

describe('commission is billed on the catalogue price', () => {
  const feeFor = (declared, list, rate = 10) => computeCommission(
    { price: declared, quantity: 1, gstRate: 18 },
    rate,
    { baseItem: { price: list, quantity: 1, gstRate: 18 } },
  );

  it('the exploit: declaring Rs.100 no longer shrinks the fee', () => {
    const honest = feeFor(2500, 2500);
    const cheat = feeFor(100, 2500);
    expect(honest.platformFee).toBeCloseTo(211.86, 2);
    expect(cheat.platformFee).toBeCloseTo(211.86, 2); // identical
  });

  it.each([2500, 2000, 1000, 500, 250])('fee stays 211.86 whatever price is declared (%s)', (declared) => {
    expect(feeFor(declared, 2500).platformFee).toBeCloseTo(211.86, 2);
  });

  it('the receipt still reflects the declared price', () => {
    const r = feeFor(2000, 2500);
    expect(r.lineTotal).toBe(2000);
    expect(r.taxableValue).toBeCloseTo(1694.92, 2);   // of the actual sale
    expect(r.commissionBase).toBeCloseTo(2118.64, 2); // of the catalogue price
  });

  it('the vendor absorbs the discount, not the platform', () => {
    const r = feeFor(2000, 2500);
    expect(r.vendorEarning).toBeCloseTo(2000 - 211.86, 2);
    expect(Math.round((r.platformFee + r.vendorEarning) * 100) / 100).toBe(r.lineTotal);
  });

  it('omitting baseItem leaves marketplace behaviour untouched', () => {
    const marketplace = computeCommission({ price: 2500, quantity: 1, gstRate: 18 }, 10);
    expect(marketplace.platformFee).toBeCloseTo(211.86, 2);
    expect(marketplace.commissionBase).toBe(marketplace.taxableValue);
  });

  it('scales with quantity', () => {
    const r = feeFor(100, 2500);
    const r3 = computeCommission(
      { price: 100, quantity: 3, gstRate: 18 }, 10,
      { baseItem: { price: 2500, quantity: 3, gstRate: 18 } },
    );
    expect(r3.platformFee).toBeCloseTo(r.platformFee * 3, 1);
  });
});

describe('assertFeeCoveredBySale', () => {
  it('allows a sale that covers the fee', () => {
    expect(() => assertFeeCoveredBySale({
      platformFee: 211.86, vendorEarning: 1788.14, title: 'x', sellingPrice: 2000, listPrice: 2500,
    })).not.toThrow();
  });

  it('allows exactly break-even', () => {
    expect(() => assertFeeCoveredBySale({
      platformFee: 211.86, vendorEarning: 0, title: 'x', sellingPrice: 211.86, listPrice: 2500,
    })).not.toThrow();
  });

  it('rejects a discount so deep the fee exceeds the sale', () => {
    expect(() => assertFeeCoveredBySale({
      platformFee: 211.86, vendorEarning: -111.86, title: 'Grinder', sellingPrice: 100, listPrice: 2500,
    })).toThrow(/too low/);
  });

  it('names the product and both prices so the operator can act', () => {
    try {
      assertFeeCoveredBySale({
        platformFee: 211.86, vendorEarning: -111.86, title: 'Grinder', sellingPrice: 100, listPrice: 2500,
      });
    } catch (e) {
      expect(e.message).toContain('Grinder');
      expect(e.message).toContain('211.86');
      expect(e.message).toContain('2500.00');
      expect(e.code).toBe('PRICE_BELOW_COMMISSION');
    }
  });
});

describe('clampDiscount', () => {
  it.each([
    [0, 1000, 0], [-50, 1000, 0], ['abc', 1000, 0], [undefined, 1000, 0],
    [100, 1000, 100], [1000, 1000, 1000],
    [5000, 1000, 1000],   // cannot exceed the subtotal
  ])('clampDiscount(%p, %p) -> %p', (raw, subtotal, expected) => {
    expect(clampDiscount(raw, subtotal)).toBe(expected);
  });
});

describe('assertAmountPaidMatches', () => {
  it.each([undefined, null, ''])('ignores %p', (v) => {
    expect(() => assertAmountPaidMatches(v, 1000)).not.toThrow();
  });

  it('accepts a matching or lower amount', () => {
    expect(() => assertAmountPaidMatches(1000, 1000)).not.toThrow();
    expect(() => assertAmountPaidMatches(900, 1000)).not.toThrow();
  });

  it('tolerates a paise of float noise', () => {
    expect(() => assertAmountPaidMatches(1000.01, 1000)).not.toThrow();
  });

  it('rejects an amount above the derived total', () => {
    expect(() => assertAmountPaidMatches(99999, 1000)).toThrow(/exceeds the order total/);
  });

  it.each([-1, 'lots', NaN])('rejects %p', (bad) => {
    expect(() => assertAmountPaidMatches(bad, 1000)).toThrow(/Invalid amount paid/);
  });
});
