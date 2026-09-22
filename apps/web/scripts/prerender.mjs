/**
 * Build-time prerender.
 *
 * For product, category and vendor-store routes:
 *   1. Fetches data from the live API (the same data the component fetches
 *      client-side).
 *   2. Pre-seeds the useFetch in-memory cache via entry-server.js exports.
 *   3. Calls renderRoute() from the Vite SSR bundle, which runs
 *      React's renderToString with the pre-seeded cache so every component
 *      receives real data on first render — no loading spinners.
 *   4. Injects the rendered HTML string between the <!--SSR_BODY_START-->
 *      and <!--SSR_BODY_END--> sentinels in the shell, replacing the
 *      initial-loader, and stamps data-ssr="1" on #root.
 *   5. Embeds the seeds as JSON in a <script id="__SSR_DATA__"> tag so
 *      the client can re-hydrate the cache before calling hydrateRoot,
 *      giving React a content-identical first render and a clean hydration.
 *   6. Applies per-route meta tags (title, description, canonical, OG).
 *   7. Writes one complete HTML file per route to dist/<path>/index.html.
 *
 * For blog posts:
 *   BlogPost.jsx calls DOMPurify.sanitize() at render time, which requires
 *   a real DOM unavailable in Node.js.  Blog routes fall back to the
 *   meta-tag-injection approach (head tags updated, body stays as the SPA
 *   shell).  The SPA boots and renders blog content client-side as before.
 *
 * If the API is unreachable at build time this script logs a warning and
 * exits 0.  A URL without a prerendered file falls through to the SPA shell
 *  — exactly today's behaviour.  The build must never fail because the
 * backend was asleep.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST       = path.resolve(__dirname, '../dist');
const SITE_URL   = 'https://www.macgly.com';
const DEFAULT_OG = `${SITE_URL}/og-image.png`;
const API        = (process.env.PRERENDER_API_URL || 'https://macgly.onrender.com').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.PRERENDER_TIMEOUT_MS || 20_000);

// ── tiny helpers ─────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clamp = (s, n) => {
  const t = String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
};

async function getJson(pathname) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}${pathname}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Bounded-concurrency map. Failures resolve to null. */
async function mapLimit(items, limit, worker) {
  const out    = new Array(items.length);
  let   cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try { out[i] = await worker(items[i]); } catch { out[i] = null; }
    }
  }));
  return out;
}

// ── HTML mutation helpers ─────────────────────────────────────────────────────

/**
 * Rewrite the meta tags that setMeta() owns.
 * Everything else in index.html is left byte-identical.
 */
function applyMeta(html, { title, description, canonical, image, type, noindex }) {
  const img           = image || DEFAULT_OG;
  const isDefaultImg  = img === DEFAULT_OG;
  let   out           = html;
  const rep = (re, val) => { if (re.test(out)) out = out.replace(re, val); };

  rep(/<title>[\s\S]*?<\/title>/,                                  `<title>${esc(title)}</title>`);
  rep(/<meta name="description" content="[^"]*"\s*\/>/,            `<meta name="description" content="${esc(description)}" />`);
  rep(/<link rel="canonical" href="[^"]*"\s*\/>/,                  `<link rel="canonical" href="${esc(canonical)}" />`);
  rep(/<meta property="og:url" content="[^"]*"\s*\/>/,             `<meta property="og:url" content="${esc(canonical)}" />`);
  rep(/<meta property="og:title" content="[^"]*"\s*\/>/,           `<meta property="og:title" content="${esc(title)}" />`);
  rep(/<meta property="og:description" content="[^"]*"\s*\/>/,     `<meta property="og:description" content="${esc(description)}" />`);
  rep(/<meta property="og:image" content="[^"]*"\s*\/>/,           `<meta property="og:image" content="${esc(img)}" />`);
  rep(/<meta property="og:type" content="[^"]*"\s*\/>/,            `<meta property="og:type" content="${esc(type || 'website')}" />`);
  rep(/<meta name="twitter:title" content="[^"]*"\s*\/>/,          `<meta name="twitter:title" content="${esc(title)}" />`);
  rep(/<meta name="twitter:description" content="[^"]*"\s*\/>/,    `<meta name="twitter:description" content="${esc(description)}" />`);
  rep(/<meta name="twitter:image" content="[^"]*"\s*\/>/,          `<meta name="twitter:image" content="${esc(img)}" />`);

  if (!isDefaultImg) {
    out = out.replace(/\s*<meta property="og:image:width" content="[^"]*"\s*\/>/, '')
             .replace(/\s*<meta property="og:image:height" content="[^"]*"\s*\/>/, '');
  }
  if (noindex && !/name="robots"/.test(out)) {
    out = out.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>');
  }
  return out;
}

/**
 * Replace the <!--SSR_BODY_START-->…<!--SSR_BODY_END--> block in the shell
 * with the server-rendered HTML, stamp data-ssr="1" on #root, and embed
 * the seeds JSON for client-side cache hydration.
 *
 * The seeds JSON is embedded in a <script type="application/json"> tag
 * (not text/javascript) so it is never executed, just parsed by main.jsx.
 * </script> sequences inside the JSON are escaped to prevent early tag close.
 */
function injectSSR(html, ssrBody, seeds) {
  const seedsJson = JSON.stringify(seeds)
    .replace(/<\//g, '<\\/')        // prevent </script> closing the tag early
    .replace(/<!--/g, '<\\!--');    // prevent embedded comment openers

  return html
    .replace('<div id="root">', '<div id="root" data-ssr="1">')
    .replace(
      /<!--SSR_BODY_START-->[\s\S]*?<!--SSR_BODY_END-->/,
      `${ssrBody}<script id="__SSR_DATA__" type="application/json">${seedsJson}</script>`,
    );
}

async function emit(routePath, html) {
  const dir = path.join(DIST, routePath);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html, 'utf8');
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Verify client build output ────────────────────────────────────────
  const shellPath = path.join(DIST, 'index.html');
  if (!existsSync(shellPath)) {
    console.error('[prerender] dist/index.html not found — run vite build first.');
    process.exit(1);
  }
  const shell = await readFile(shellPath, 'utf8');

  if (!shell.includes('<!--SSR_BODY_START-->')) {
    console.error('[prerender] SSR sentinels missing from dist/index.html. '
      + 'Ensure apps/web/index.html contains <!--SSR_BODY_START--> and <!--SSR_BODY_END-->.');
    process.exit(1);
  }

  // ── 2. Load the SSR render bundle ────────────────────────────────────────
  const ssrBundle = path.resolve(__dirname, '../dist-ssr/entry-server.js');
  if (!existsSync(ssrBundle)) {
    console.error('[prerender] dist-ssr/entry-server.js not found — run: vite build --ssr src/entry-server.jsx --outDir dist-ssr');
    process.exit(1);
  }
  const { renderRoute } = await import(ssrBundle);

  // ── 3. Fetch all data ────────────────────────────────────────────────────
  let products = [], categories = [], posts = [];
  try {
    const [pRes, cRes, bRes] = await Promise.all([
      getJson('/api/catalog/products?limit=1000'),
      getJson('/api/catalog/categories'),
      getJson('/api/blog?limit=500'),
    ]);
    products   = pRes.products  || [];
    categories = cRes.categories || cRes.data || [];
    posts      = bRes.posts     || [];
  } catch (err) {
    console.warn(`[prerender] SKIPPED — ${API} unreachable (${err.message}).`);
    console.warn('[prerender] Build continues; routes fall back to the SPA shell.');
    return;
  }

  // ── 4. Product detail pages ───────────────────────────────────────────────
  // Fetch the full product detail (list endpoint strips description).
  // These detail responses are also what we seed into useFetch cache,
  // so the Product component renders with the complete data object.
  console.log(`[prerender] fetching ${products.filter(p => p.slug).length} product details…`);
  const productDetails = new Map(); // slug → full product object
  const detailResults  = await mapLimit(products.filter(p => p.slug), 8, async (p) => {
    const r = await getJson(`/api/catalog/products/${encodeURIComponent(p.slug)}`);
    return r.product ? [p.slug, r.product] : null;
  });
  for (const entry of detailResults) {
    if (entry) productDetails.set(entry[0], entry[1]);
  }
  console.log(`[prerender] fetched ${productDetails.size}/${products.length} product details`);

  let count = 0;

  for (const p of products) {
    if (!p.slug) continue;
    const detail  = productDetails.get(p.slug) || p;
    const img     = detail.images?.find((i) => typeof i === 'string' && i.startsWith('http'));
    const title   = detail.seo?.title
      || `${detail.title} - Buy Online at Best Price | Macgly`;
    const fallback = [`Buy ${detail.title} online at Macgly.`,
      detail.brand && `Brand: ${detail.brand}.`,
      'Genuine product with GST invoice and pan-India delivery.'].filter(Boolean).join(' ');
    const description = detail.seo?.description
      || clamp(detail.description, 160)
      || clamp(fallback, 160);

    // The seed shape must match what useFetch stores when the component
    // calls: api.get(`/catalog/products/${slug}`).then(r => r.data)
    // → r.data === { product: { ... } }
    const seeds = [{ key: ['product', p.slug], data: { product: detail } }];

    let ssrBody = '';
    try {
      ssrBody = renderRoute(`/product/${p.slug}`, seeds);
    } catch (err) {
      console.warn(`[prerender] SSR error /product/${p.slug}: ${err.message}`);
    }

    let pageHtml = applyMeta(shell, {
      title, description,
      canonical: `${SITE_URL}/product/${p.slug}`,
      image: img,
      type: 'product',
    });
    if (ssrBody) pageHtml = injectSSR(pageHtml, ssrBody, seeds);

    await emit(`product/${p.slug}`, pageHtml);
    count++;
  }

  // ── 5. Category pages ────────────────────────────────────────────────────
  for (const c of categories) {
    if (!c.slug) continue;

    // Derive first-page product listing from the already-fetched product list
    // (avoids N extra HTTP requests — one request per category).
    const catProducts = products
      .filter((p) => {
        const ids = Array.isArray(p.categoryIds) ? p.categoryIds : [];
        return ids.some((cid) => String(cid?._id ?? cid) === String(c._id));
      })
      .slice(0, 24);

    const title       = `${c.name} - Tools & Equipment Online India | Macgly`;
    const description = clamp(c.description, 160)
      || `Shop ${c.name} from trusted vendors on Macgly. Genuine products, fast delivery across India.`;

    // Seed shapes must match what each useFetch call expects:
    //   ['category', slug]   → api.get('/catalog/categories/:slug').then(r => r.data) = { category }
    //   ['categories']       → api.get('/catalog/categories').then(r => r.data)       = { categories }
    //   ['category-products', slug, page, sort, ...filters]
    //                        → api.get('/catalog/products', {...}).then(r => r.data)  = { products, pagination }
    const seeds = [
      { key: ['category', c.slug],                                    data: { category: c } },
      { key: ['categories'],                                          data: { categories } },
      { key: ['category-products', c.slug, 1, 'newest', '', '', '', ''],
        data: { products: catProducts, pagination: { total: catProducts.length, pages: 1, page: 1, limit: 24 } } },
    ];

    let ssrBody = '';
    try {
      ssrBody = renderRoute(`/category/${c.slug}`, seeds);
    } catch (err) {
      console.warn(`[prerender] SSR error /category/${c.slug}: ${err.message}`);
    }

    let pageHtml = applyMeta(shell, {
      title, description,
      canonical: `${SITE_URL}/category/${c.slug}`,
      image: typeof c.image === 'string' && c.image.startsWith('http') ? c.image : undefined,
    });
    if (ssrBody) pageHtml = injectSSR(pageHtml, ssrBody, seeds);

    await emit(`category/${c.slug}`, pageHtml);
    count++;
  }

  // ── 6. Blog posts (meta-tag injection only — no SSR) ─────────────────────
  // DOMPurify requires a live DOM to sanitise HTML.  Until we add jsdom or
  // switch to isomorphic-dompurify, blog routes use head-only injection and
  // the SPA renders the body client-side.
  for (const b of posts) {
    if (!b.slug) continue;
    const img = b.coverImage || b.featuredImage;
    await emit(`blog/${b.slug}`, applyMeta(shell, {
      title:       `${b.title} | Macgly Blog`,
      description: clamp(b.excerpt || b.content, 160),
      canonical:   `${SITE_URL}/blog/${b.slug}`,
      image:       typeof img === 'string' && img.startsWith('http') ? img : undefined,
      type:        'article',
    }));
    count++;
  }

  // ── 7. Vendor store pages ─────────────────────────────────────────────────
  const vendors = new Map();
  for (const p of products) {
    const v = p.vendorId;
    if (!v || typeof v !== 'object' || !v._id) continue;
    if (!vendors.has(String(v._id))) vendors.set(String(v._id), v);
  }

  for (const [id, v] of vendors) {
    const fallbackName = v.vendorProfile?.storeName || v.vendorProfile?.businessName || v.name || 'Store';

    // Fetch the public vendor profile (includes storeDescription, etc.)
    let vendorPublic = null;
    try {
      const vRes = await getJson(`/api/vendors/${id}/public`);
      vendorPublic = vRes.vendor || null;
    } catch {}

    const vendorName = vendorPublic
      ? (vendorPublic.storeName || vendorPublic.name || fallbackName)
      : fallbackName;
    const vendorDesc = vendorPublic?.storeDescription
      || `Browse tools, machinery and spare parts sold by ${vendorName} on Macgly.`;

    const storeProducts = products
      .filter((p) => String(p.vendorId?._id || p.vendorId) === id)
      .slice(0, 48);

    // Seed shapes:
    //   ['vendor-store', id]          → api.get('/vendors/:id/public') = { vendor }
    //   ['vendor-store-products', id] → api.get('/catalog/products', ...) = { products }
    const seeds = [
      { key: ['vendor-store', id],          data: { vendor: vendorPublic || v } },
      { key: ['vendor-store-products', id], data: { products: storeProducts } },
    ];

    let ssrBody = '';
    try {
      ssrBody = renderRoute(`/store/${id}`, seeds);
    } catch (err) {
      console.warn(`[prerender] SSR error /store/${id}: ${err.message}`);
    }

    let pageHtml = applyMeta(shell, {
      title:       `${vendorName} — Tools & Machinery Store | Macgly`,
      description: clamp(vendorDesc, 160),
      canonical:   `${SITE_URL}/store/${id}`,
    });
    if (ssrBody) pageHtml = injectSSR(pageHtml, ssrBody, seeds);

    await emit(`store/${id}`, pageHtml);
    count++;
  }

  console.log(
    `[prerender] wrote ${count} route files `
    + `(${products.length} products · ${categories.length} categories · `
    + `${posts.length} blog posts · ${vendors.size} vendor stores)`,
  );
}

main().catch((err) => {
  // Never fail the CI build on a prerender problem.
  console.warn('[prerender] SKIPPED —', err.message);
});
