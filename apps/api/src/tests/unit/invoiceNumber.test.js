const { renderInvoiceNumber, DEFAULT_FORMAT } = require('../../services/invoiceNumberService');

describe('renderInvoiceNumber', () => {
  const base = { prefix: 'MGY', financialYear: '2026-27', sequence: 42, sequenceWidth: 5 };

  it('renders the default format', () => {
    expect(renderInvoiceNumber(DEFAULT_FORMAT, base)).toBe('MGY/2026-27/00042');
  });

  it('pads the sequence to the configured width', () => {
    expect(renderInvoiceNumber('{SEQ}', { ...base, sequence: 7, sequenceWidth: 3 })).toBe('007');
    expect(renderInvoiceNumber('{SEQ}', { ...base, sequence: 7, sequenceWidth: 8 })).toBe('00000007');
  });

  it('does not truncate a sequence wider than the pad width', () => {
    expect(renderInvoiceNumber('{SEQ}', { ...base, sequence: 1234567, sequenceWidth: 3 })).toBe('1234567');
  });

  it('supports a per-vendor custom layout without code changes', () => {
    expect(renderInvoiceNumber('INV-{FY}-{PREFIX}-{SEQ}', base)).toBe('INV-2026-27-MGY-00042');
  });

  it('replaces every occurrence of a placeholder', () => {
    expect(renderInvoiceNumber('{PREFIX}/{PREFIX}/{SEQ}', base)).toBe('MGY/MGY/00042');
  });

  it('leaves unknown placeholders untouched rather than emitting undefined', () => {
    expect(renderInvoiceNumber('{PREFIX}/{BRANCH}/{SEQ}', base)).toBe('MGY/{BRANCH}/00042');
  });

  it('falls back to the default format when none is stored', () => {
    expect(renderInvoiceNumber(null, base)).toBe('MGY/2026-27/00042');
    expect(renderInvoiceNumber('', base)).toBe('MGY/2026-27/00042');
  });

  it('renders empty strings, not "undefined", for missing parts', () => {
    const out = renderInvoiceNumber(DEFAULT_FORMAT, { sequence: 1 });
    expect(out).not.toMatch(/undefined/);
    expect(out).toBe('//00001');
  });

  it('defaults the pad width to 5', () => {
    expect(renderInvoiceNumber('{SEQ}', { sequence: 9 })).toBe('00009');
  });
});
