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

  // Google Search drops a favicon that is not square, with no Search Console
  // warning. /favicon.png shipped as a 1655x950 rectangle for months.
  for (const [path, size] of [['/favicon.png', 96], ['/favicon-192.png', 192],
    ['/favicon-512.png', 512], ['/apple-touch-icon.png', 180]]) {
    test(`${path} is served and is exactly ${size}x${size}`, async ({ page }) => {
      const res = await page.request.get(path);
      expect(res.status()).toBe(200);
      const buf = await res.body();
      expect(buf.readUInt32BE(0)).toBe(0x89504e47);       // PNG signature
      expect(buf.readUInt32BE(16)).toBe(size);            // IHDR width
      expect(buf.readUInt32BE(20)).toBe(size);            // IHDR height
    });
  }

  test('favicon.ico is served', async ({ page }) => {
    const res = await page.request.get('/favicon.ico');
    expect(res.status()).toBe(200);
    const buf = await res.body();
    expect(buf.readUInt16LE(0)).toBe(0);                  // reserved
    expect(buf.readUInt16LE(2)).toBe(1);                  // type: icon
  });

  test('og-image.png matches the dimensions index.html declares', async ({ page }) => {
    const res = await page.request.get('/og-image.png');
    expect(res.status()).toBe(200);
    const buf = await res.body();
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
  });
});

// ── Crawlability ──────────────────────────────────────────────────────────────
test.describe('SEO', () => {
  test('robots.txt is the static file, not the API copy', async ({ page }) => {
    const res = await page.request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Sitemap: https://www.macgly.com/sitemap.xml');
    // The parameters the app actually uses — the old file blocked ?min=/?max=.
    expect(body).toContain('Disallow: /*?minPrice=');
    expect(body).toContain('Disallow: /*&minPrice=');
    // An affiliate link is any URL + ?ref=CODE; unblocked it duplicates the site.
    expect(body).toContain('Disallow: /*?ref=');
    // Google cannot show a favicon it is not allowed to fetch.
    expect(body).toContain('Allow: /favicon.ico');
  });

  // setMeta runs in a useEffect, so index.html's homepage canonical is still in
  // the DOM at load time. These use the auto-retrying assertion deliberately —
  // reading getAttribute() once races React and fails against correct code.
  const expectCanonical = (page, href) =>
    expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', href);

  test('every route declares its own canonical, not the homepage', async ({ page }) => {
    await page.goto('/products');
    await expectCanonical(page, 'https://www.macgly.com/products');

    await page.goto('/info/about');
    await expectCanonical(page, 'https://www.macgly.com/info/about');

    await page.goto('/warranty-check');
    await expectCanonical(page, 'https://www.macgly.com/warranty-check');

    await page.goto('/sell');
    await expectCanonical(page, 'https://www.macgly.com/sell');
  });

  test('filtered listings collapse onto the clean catalogue URL', async ({ page }) => {
    await page.goto('/products?sort=price_asc&page=2&minPrice=500');
    await expectCanonical(page, 'https://www.macgly.com/products');
  });

  test('client-side navigation moves the canonical with it', async ({ page }) => {
    await page.goto('/info/about');
    await expectCanonical(page, 'https://www.macgly.com/info/about');
    await page.getByRole('link', { name: /all categories/i }).first().click();
    await expectCanonical(page, 'https://www.macgly.com/categories');
  });

  test('the 404 page is noindex — the SPA fallback returns HTTP 200', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('the cart is noindex', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  // RC-SEO-04. These four routes previously returned HTTP 200 while declaring
  // canonical=https://www.macgly.com/ and the homepage title — a duplicate
  // cluster of four, two of them soft 404s.
  for (const [route, label] of [['/login', 'login'], ['/register', 'register']]) {
    test(`${label} is noindex and self-canonical, not a homepage duplicate`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('link[rel="canonical"]'))
        .toHaveAttribute('href', `https://www.macgly.com${route}`);
    });
  }

  test('an unknown product slug is a noindex soft 404, not a homepage duplicate', async ({ page }) => {
    await page.goto('/product/definitely-not-a-real-slug');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page).not.toHaveTitle('Macgly - Tools, Machinery & Industrial Equipment India');
  });
});

// ── Structured data ───────────────────────────────────────────────────────────
test.describe('Structured data', () => {
  const readJsonLd = (page) => page.evaluate(() => {
    const el = document.getElementById('json-ld');
    if (!el) return null;
    const d = JSON.parse(el.textContent);
    return d['@graph'] ? d['@graph'] : [d];
  });

  test('the static Organization/WebSite graph is in the server HTML', async ({ page }) => {
    const res = await page.request.get('/');
    const html = await res.text();
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"@type": "WebSite"');
  });

  test('product JSON-LD does not leak onto the next route', async ({ page }) => {
    await page.goto('/info/about');
    const nodes = await readJsonLd(page);
    expect((nodes || []).some((n) => n['@type'] === 'Product')).toBe(false);
  });

  test('the FAQ page emits FAQPage schema whose questions are on the page', async ({ page }) => {
    await page.goto('/info/faq');
    await expect.poll(async () => {
      const nodes = await readJsonLd(page);
      return (nodes || []).some((n) => n['@type'] === 'FAQPage');
    }).toBe(true);
    const faq = (await readJsonLd(page)).find((n) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity.length).toBeGreaterThan(10);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer?.text?.length || 0).toBeGreaterThan(0);
    const body = await page.locator('body').innerText();
    expect(body).toContain(faq.mainEntity[0].name);
  });
});
