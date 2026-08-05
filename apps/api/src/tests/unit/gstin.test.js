const { isValidGstinFormat, stateCodeFromGstin, financialYear } = require('../../utils/gstin');

// 33 = Tamil Nadu, valid structure
const TN_GSTIN = '33AAACM1234C1ZP';

describe('isValidGstinFormat', () => {
  it('accepts a structurally valid GSTIN', () => {
    expect(isValidGstinFormat(TN_GSTIN)).toBe(true);
  });

  it('accepts lowercase and surrounding whitespace', () => {
    expect(isValidGstinFormat(`  ${TN_GSTIN.toLowerCase()} `)).toBe(true);
  });

  it.each([
    ['too short', '33AAACM1234C1Z'],
    ['too long', '33AAACM1234C1ZPX'],
    ['missing the literal Z', '33AAACM1234C1AP'],
    ['letters where the state code goes', 'AAAAACM1234C1ZP'],
    ['digits where the PAN letters go', '33123451234C1ZP'],
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['number', 33],
    ['object', {}],
  ])('rejects %s', (_label, input) => {
    expect(isValidGstinFormat(input)).toBe(false);
  });
});

describe('stateCodeFromGstin', () => {
  it('returns the leading two digits', () => {
    expect(stateCodeFromGstin(TN_GSTIN)).toBe('33');
    expect(stateCodeFromGstin('27AAACM1234C1ZP')).toBe('27'); // Maharashtra
  });

  it('returns null for anything malformed rather than a wrong code', () => {
    expect(stateCodeFromGstin('nonsense')).toBeNull();
    expect(stateCodeFromGstin(null)).toBeNull();
  });
});

describe('financialYear', () => {
  it.each([
    ['2026-04-01T00:00:00Z', '2026-27'],
    ['2026-06-15T12:00:00Z', '2026-27'],
    ['2026-12-31T23:59:00Z', '2026-27'],
    ['2027-03-31T00:00:00Z', '2026-27'],
    ['2027-04-01T00:00:00Z', '2027-28'],
    ['2026-01-15T00:00:00Z', '2025-26'],
  ])('maps %s to FY %s', (iso, expected) => {
    expect(financialYear(new Date(iso))).toBe(expected);
  });

  it('rolls over at 1 April IST, not 1 April UTC', () => {
    // 31 Mar 2027 20:00 UTC == 1 Apr 2027 01:30 IST -> new financial year
    expect(financialYear(new Date('2027-03-31T20:00:00Z'))).toBe('2027-28');
    // 31 Mar 2027 18:00 UTC == 31 Mar 2027 23:30 IST -> still the old year
    expect(financialYear(new Date('2027-03-31T18:00:00Z'))).toBe('2026-27');
  });

  it('formats the second year as two padded digits across a century boundary', () => {
    expect(financialYear(new Date('2099-05-01T00:00:00Z'))).toBe('2099-00');
    expect(financialYear(new Date('2100-05-01T00:00:00Z'))).toBe('2100-01');
  });
});
