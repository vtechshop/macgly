import { describe, test, expect } from 'vitest';
import { formatCurrency, formatDate, normalizeImageUrl, formatRelativeTime } from '../utils/format';

describe('formatCurrency', () => {
  test('formats INR correctly', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1,000');
    expect(result).toContain('₹');
  });

  test('handles zero', () => {
    expect(formatCurrency(0)).toContain('0');
  });

  test('handles large amounts', () => {
    const result = formatCurrency(100000);
    expect(result).toContain('1,00,000');
  });

  test('handles decimal amounts', () => {
    const result = formatCurrency(999.99);
    expect(result).toContain('999.99');
  });

  test('formats USD when specified', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('100');
  });
});

describe('formatDate', () => {
  test('formats a date string', () => {
    const result = formatDate('2025-01-15');
    expect(result).toContain('2025');
    expect(result).toMatch(/Jan|Jan/);
  });

  test('formats a Date object', () => {
    const result = formatDate(new Date('2024-06-01'));
    expect(result).toContain('2024');
  });

  test('formats a timestamp', () => {
    const result = formatDate(1704067200000);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('normalizeImageUrl', () => {
  test('returns undefined/null as-is', () => {
    expect(normalizeImageUrl(null)).toBeNull();
    expect(normalizeImageUrl(undefined)).toBeUndefined();
  });

  test('strips localhost origin from upload URLs', () => {
    const url = 'http://localhost:5000/uploads/image.jpg';
    expect(normalizeImageUrl(url)).toBe('/uploads/image.jpg');
  });

  test('leaves Cloudinary URLs unchanged', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    expect(normalizeImageUrl(url)).toBe(url);
  });

  test('leaves relative URLs unchanged', () => {
    const url = '/uploads/file.png';
    expect(normalizeImageUrl(url)).toBe(url);
  });
});

describe('formatRelativeTime', () => {
  test('returns "just now" for very recent dates', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  test('returns minutes ago for recent dates', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  test('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  test('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});
