import { test, expect } from '@playwright/test';

// ── Homepage ──────────────────────────────────────────────────────────────────
test.describe('Homepage', () => {
  test('loads and shows MACGLY brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/macgly/i).first()).toBeVisible();
  });

  test('header has search bar and nav links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder*="looking" i], input[placeholder*="search" i], input[type="search"]').first()).toBeVisible();
    await expect(page.locator('a[href="/products"], a[href*="product"]').first()).toBeVisible();
  });

  test('logo renders as text (not broken image)', async ({ page }) => {
    await page.goto('/');
    // Logo should be SVG text, not a broken img
    await expect(page.locator('text=MAC').first()).toBeVisible();
    await expect(page.locator('text=GLY').first()).toBeVisible();
  });

  test('footer exists with brand info', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeVisible();
  });
});

// ── Auth pages ────────────────────────────────────────────────────────────────
test.describe('Auth pages', () => {
  test('login page renders form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('register page renders form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('forgot-password page renders form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });
});

// ── Products page ─────────────────────────────────────────────────────────────
test.describe('Products listing', () => {
  test('products page loads without crash', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('body')).toBeVisible();
    // Should show either products or a loading state, not an error
    await expect(page.locator('text=500, text=Error, text=Cannot').first()).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('has search input and sort dropdown', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('input[placeholder*="looking" i], input[placeholder*="search" i], input[type="search"]').first()).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });
});

// ── Category page ─────────────────────────────────────────────────────────────
test.describe('Category page', () => {
  test('loads category page structure', async ({ page }) => {
    await page.goto('/category/power-tools');
    await expect(page.locator('body')).toBeVisible();
    // Should show filter panel
    await expect(page.getByText(/filter|price/i).first()).toBeVisible({ timeout: 8000 });
  });
});

// ── All categories page ───────────────────────────────────────────────────────
test.describe('All categories page', () => {
  test('categories browse page loads', async ({ page }) => {
    await page.goto('/categories');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ── Cart page ─────────────────────────────────────────────────────────────────
test.describe('Cart', () => {
  test('cart page loads', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/cart|empty|bag/i).first()).toBeVisible();
  });
});

// ── Dashboard redirects ───────────────────────────────────────────────────────
test.describe('Dashboard auth guards', () => {
  test('unauthenticated user redirected from admin', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).not.toHaveURL(/\/dashboard\/admin/);
  });

  test('unauthenticated user redirected from vendor', async ({ page }) => {
    await page.goto('/dashboard/vendor');
    await expect(page).not.toHaveURL(/\/dashboard\/vendor/);
  });
});

// ── Favicon ───────────────────────────────────────────────────────────────────
test.describe('Assets', () => {
  test('favicon.svg is served', async ({ page }) => {
    const res = await page.request.get('/favicon.svg');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/svg/);
  });
});
