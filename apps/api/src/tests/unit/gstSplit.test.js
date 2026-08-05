const { splitGst, resolveSupplierStateCode } = require('../../utils/tax');
const { stateCodeFromName, canonicalStateCode } = require('../../utils/indianStates');

const TN = '33';
const MH = '27';
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

describe('stateCodeFromName', () => {
  it.each([
    ['Tamil Nadu', '33'], ['TAMIL NADU', '33'], ['tamilnadu', '33'], ['TN', '33'],
    ['Maharashtra', '27'], ['Karnataka', '29'], ['Delhi', '07'], ['New Delhi', '07'],
    ['Jammu & Kashmir', '01'], ['Jammu and Kashmir', '01'],
    ['Odisha', '21'], ['Orissa', '21'],
    ['Uttarakhand', '05'], ['Uttaranchal', '05'],
    ['Puducherry', '34'], ['Pondicherry', '34'],
    ['Telangana', '36'], ['Kerala', '32'], ['Gujarat', '24'],
  ])('resolves %s to %s', (name, code) => {
    expect(stateCodeFromName(name)).toBe(code);
  });

  it('returns null rather than guessing on unrecognised input', () => {
    ['', null, undefined, '-', 'Atlantis', '  ', 'State'].forEach((v) => {
      expect(stateCodeFromName(v)).toBeNull();
    });
  });

  it('folds superseded codes onto their current equivalent', () => {
    expect(canonicalStateCode('28')).toBe('37'); // old Andhra Pradesh
    expect(canonicalStateCode('25')).toBe('26'); // Daman & Diu merger
    expect(canonicalStateCode('33')).toBe('33');
    expect(canonicalStateCode('99')).toBeNull();
  });
});

describe('resolveSupplierStateCode', () => {
  it('uses the platform state for admin-owned products', () => {
    expect(resolveSupplierStateCode(null, '33')).toBe('33');
    expect(resolveSupplierStateCode(undefined, '27')).toBe('27');
  });

  it('derives the vendor state from their GSTIN', () => {
    expect(resolveSupplierStateCode({ vendorProfile: { gstin: '27AAACM1234C1ZP' } }, '33')).toBe('27');
  });

  it('returns null for a vendor with no or malformed GSTIN', () => {
    expect(resolveSupplierStateCode({ vendorProfile: {} }, '33')).toBeNull();
    expect(resolveSupplierStateCode({ vendorProfile: { gstin: '' } }, '33')).toBeNull();
    expect(resolveSupplierStateCode({ vendorProfile: { gstin: 'NOTAGSTIN' } }, '33')).toBeNull();
  });

  it('canonicalises a vendor registered under the old Andhra Pradesh code', () => {
    expect(resolveSupplierStateCode({ vendorProfile: { gstin: '28AAACM1234C1ZP' } }, '33')).toBe('37');
  });
});

describe('splitGst — intra-state (CGST + SGST)', () => {
  it.each([
    [2500, 5,  119.05, 2380.95],
    [2500, 12, 267.86, 2232.14],
    [2500, 18, 381.36, 2118.64],
    [2500, 28, 546.88, 1953.12],
  ])('Rs.%s inclusive at %s%%', (lineTotal, rate, expectedGst, expectedTaxable) => {
    const r = splitGst({ lineTotal, rate, supplierStateCode: TN, placeOfSupplyStateCode: TN });
    expect(r.gstAmount).toBeCloseTo(expectedGst, 2);
    expect(r.taxableValue).toBeCloseTo(expectedTaxable, 2);
    expect(r.igst).toBe(0);
    expect(r.interState).toBe(false);
    // The halves must always reconstruct the total exactly.
    expect(r.cgst + r.sgst).toBeCloseTo(r.gstAmount, 2);
    // ...and the whole line must reconstruct too.
    expect(r.taxableValue + r.gstAmount).toBeCloseTo(lineTotal, 2);
  });

  it('keeps CGST and SGST within one paise of each other', () => {
    // Rs.119.05 cannot be halved evenly, so 59.53 + 59.52. Both are exact to the
    // paise; only their IEEE-754 sum carries representation noise, hence round2.
    const r = splitGst({ lineTotal: 2500, rate: 5, supplierStateCode: TN, placeOfSupplyStateCode: TN });
    expect(r.cgst).toBe(59.53);
    expect(r.sgst).toBe(59.52);
    expect(Math.abs(r.cgst - r.sgst)).toBeLessThanOrEqual(0.01);
    expect(round2(r.cgst + r.sgst)).toBe(r.gstAmount);
  });

  it('components reconstruct the total for every standard rate', () => {
    for (const rate of [5, 12, 18, 28]) {
      for (const lineTotal of [1, 99.99, 2500, 13333.33, 999999.99]) {
        const r = splitGst({ lineTotal, rate, supplierStateCode: TN, placeOfSupplyStateCode: TN });
        expect(round2(r.cgst + r.sgst)).toBe(r.gstAmount);
        expect(round2(r.taxableValue + r.gstAmount)).toBe(round2(lineTotal));
      }
    }
  });
});

describe('splitGst — inter-state (IGST)', () => {
  it.each([[2500, 5, 119.05], [2500, 12, 267.86], [2500, 18, 381.36], [2500, 28, 546.88]])(
    'Rs.%s inclusive at %s%%', (lineTotal, rate, expectedGst) => {
      const r = splitGst({ lineTotal, rate, supplierStateCode: TN, placeOfSupplyStateCode: MH });
      expect(r.igst).toBeCloseTo(expectedGst, 2);
      expect(r.cgst).toBe(0);
      expect(r.sgst).toBe(0);
      expect(r.interState).toBe(true);
      expect(r.taxableValue + r.igst).toBeCloseTo(lineTotal, 2);
    },
  );

  it('treats old and new Andhra Pradesh codes as the same state', () => {
    const r = splitGst({ lineTotal: 1000, rate: 18, supplierStateCode: '28', placeOfSupplyStateCode: '37' });
    expect(r.interState).toBe(false);
    expect(r.igst).toBe(0);
  });
});

describe('splitGst — undeterminable state', () => {
  it.each([
    ['supplier unknown', null, TN],
    ['place of supply unknown', TN, null],
    ['both unknown', null, null],
    ['supplier empty string', '', TN],
  ])('leaves components unset when %s', (_label, supplierStateCode, placeOfSupplyStateCode) => {
    const r = splitGst({ lineTotal: 2500, rate: 18, supplierStateCode, placeOfSupplyStateCode });
    expect(r.cgst).toBeUndefined();
    expect(r.sgst).toBeUndefined();
    expect(r.igst).toBeUndefined();
    expect(r.interState).toBeNull();
    // The parts we CAN compute are still returned.
    expect(r.gstAmount).toBeCloseTo(381.36, 2);
    expect(r.taxableValue).toBeCloseTo(2118.64, 2);
  });
});

describe('splitGst — edge cases', () => {
  it('handles a zero line total', () => {
    const r = splitGst({ lineTotal: 0, rate: 18, supplierStateCode: TN, placeOfSupplyStateCode: TN });
    expect(r.gstAmount).toBe(0);
    expect(r.taxableValue).toBe(0);
    expect(r.cgst).toBe(0);
  });

  it('handles a zero rate without dividing by zero', () => {
    const r = splitGst({ lineTotal: 1000, rate: 0, supplierStateCode: TN, placeOfSupplyStateCode: TN });
    expect(r.gstAmount).toBe(0);
    expect(r.taxableValue).toBe(1000);
  });

  it('coerces missing inputs instead of returning NaN', () => {
    const r = splitGst({});
    expect(Number.isNaN(r.gstAmount)).toBe(false);
    expect(Number.isNaN(r.taxableValue)).toBe(false);
  });

  it('never emits cess — not implemented yet', () => {
    const r = splitGst({ lineTotal: 2500, rate: 18, supplierStateCode: TN, placeOfSupplyStateCode: TN });
    expect(r.cess).toBeUndefined();
  });
});
