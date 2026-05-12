const { slugify, generateSKU, generateOrderId } = require('../../utils/helpers');

describe('slugify', () => {
  test('converts to lowercase with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('removes special characters', () => {
    expect(slugify('Product! @#')).toBe('product');
  });

  test('handles numbers', () => {
    expect(slugify('iPhone 15 Pro Max')).toBe('iphone-15-pro-max');
  });

  test('trims and deduplicates hyphens', () => {
    expect(slugify('  multiple   spaces  ')).toBe('multiple-spaces');
  });

  test('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('generateSKU', () => {
  test('returns a string with default SKU prefix', () => {
    const sku = generateSKU();
    expect(sku).toMatch(/^SKU-[A-F0-9]{8}$/);
  });

  test('uses custom prefix', () => {
    const sku = generateSKU('PROD');
    expect(sku.startsWith('PROD-')).toBe(true);
  });

  test('generates unique SKUs each call', () => {
    const a = generateSKU();
    const b = generateSKU();
    expect(a).not.toBe(b);
  });

  test('is uppercase after the prefix', () => {
    const sku = generateSKU('TEST');
    const suffix = sku.split('-')[1];
    expect(suffix).toBe(suffix.toUpperCase());
  });
});

describe('generateOrderId', () => {
  test('starts with ORD-', () => {
    expect(generateOrderId().startsWith('ORD-')).toBe(true);
  });

  test('has three segments separated by hyphens', () => {
    const parts = generateOrderId().split('-');
    expect(parts).toHaveLength(3);
  });

  test('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, generateOrderId));
    expect(ids.size).toBe(100);
  });

  test('is all uppercase', () => {
    const id = generateOrderId();
    expect(id).toBe(id.toUpperCase());
  });
});
