const { resolveTaxRate, FALLBACK_TAX_RATE } = require('../../utils/tax');

describe('resolveTaxRate (PAY-01)', () => {
  it.each([
    ['5% agricultural implement', 5],
    ['12% rate', 12],
    ['18% standard', 18],
    ['28% rate', 28],
    ['fractional rate', 2.5],
  ])('returns a configured rate: %s', (_label, taxRate) => {
    expect(resolveTaxRate({ taxRate })).toBe(taxRate);
  });

  // taxRate defaults to 0 in the Product schema, so 0 means "never configured"
  // far more often than "nil-rated". Falling back preserves today's behaviour
  // rather than silently stopping tax collection.
  it.each([
    ['schema default 0', { taxRate: 0 }],
    ['missing field', {}],
    ['undefined', { taxRate: undefined }],
    ['null', { taxRate: null }],
    ['empty string', { taxRate: '' }],
    ['non-numeric', { taxRate: 'eighteen' }],
    ['NaN', { taxRate: NaN }],
    ['negative', { taxRate: -5 }],
    ['null product', null],
    ['undefined product', undefined],
  ])('falls back to 18 for %s', (_label, product) => {
    expect(resolveTaxRate(product)).toBe(FALLBACK_TAX_RATE);
  });

  it('coerces a numeric string, as Mongoose would have cast it', () => {
    expect(resolveTaxRate({ taxRate: '5' })).toBe(5);
  });

  it('never reads the non-existent gstRate field', () => {
    // A stray gstRate must not influence the result — Product has no such path.
    expect(resolveTaxRate({ gstRate: 28, taxRate: 5 })).toBe(5);
    expect(resolveTaxRate({ gstRate: 28 })).toBe(FALLBACK_TAX_RATE);
  });

  it('is the rate that makes inclusive GST arithmetic correct', () => {
    // ₹2,500 inclusive at 5% -> taxable 2380.95, GST 119.05
    const rate = resolveTaxRate({ taxRate: 5 });
    const gst = (2500 * rate) / (100 + rate);
    expect(gst).toBeCloseTo(119.05, 2);
  });
});
