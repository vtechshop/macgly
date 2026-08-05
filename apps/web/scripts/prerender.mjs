/**
 * Build-time metadata prerendering.
 *
 * WHY THIS EXISTS
 * The app is a Vite SPA: one dist/index.html is served for every URL, and the
 * per-route <title>/canonical/OG tags are written by setMeta() in a useEffect.
 * Googlebot executes JavaScript and sees them. Facebook, LinkedIn, WhatsApp,
 * Slack and X do NOT — so every shared product link previewed as the homepage.
 *
 * WHY IT IS A BUILD STEP AND NOT EXPRESS MIDDLEWARE
 * www.macgly.com is served by Vercel from the static dist/ output (verified:
 * `Server: Vercel` on the document response). Express never sees a document
 * request in production, so injecting tags there would fix nothing on the
 * public domain. Vercel serves static files BEFORE applying rewrites — the same
 * precedence that makes public/robots.txt win over the vercel.json rewrite — so
 * writing dist/product/<slug>/index.html makes Vercel serve that file for
 * /product/<slug> instead of falling through to the SPA shell.
 *
 * SCOPE
 * Only routes whose metadata comes from the database: products, categories,
 * blog posts and vendor stores. Static pages (/info/*, /sell, ...) already have
 * correct tags for Googlebot and hard-coding their copy here would duplicate
 * strings that live in JSX and drift.
 *
 * FAILURE MODE
 * If the API is unreachable this logs and exits 0. A URL with no prerendered
 * file falls through to the SPA shell — exactly today's behaviour. The build
 * must never fail because a backend was asleep.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const SITE_URL = 'https://www.macgly.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const API = (process.env.PRERENDER_API_URL || 'https://macgly.onrender.com').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.PRERENDER_TIMEOUT_MS || 20000);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clamp = (s, n) => {
  const t = String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
};

async function getJson(pathname) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}${pathname}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rewrite only the tags setMeta owns. Everything else in index.html — the icon
 * links, the Organization/WebSite graph, the preconnects, the script tag — is
 * left byte-identical, so the SPA still boots normally and then re-applies the
 * same values on hydration.
 */
function applyMeta(html, { title, description, canonical, image, type, noindex }) {
  const img = image || DEFAULT_OG_IMAGE;
  const isDefaultImage = img === DEFAULT_OG_IMAGE;
  let out = html;

  const replaceOne = (pattern, value) => {
    if (!pattern.test(out)) return false;
    out = out.replace(pattern, value);
    return true;
  };

  replaceOne(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  replaceOne(/<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${esc(description)}" />`);
  replaceOne(/<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${esc(canonical)}" />`);
  replaceOne(/<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${esc(canonical)}" />`);
  replaceOne(/<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${esc(title)}" />`);
  replaceOne(/<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${esc(description)}" />`);
  replaceOne(/<meta property="og:image" content="[^"]*"\s*\/>/,
    `<meta property="og:image" content="${esc(img)}" />`);
  replaceOne(/<meta property="og:type" content="[^"]*"\s*\/>/,
    `<meta property="og:type" content="${esc(type || 'website')}" />`);
  replaceOne(/<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${esc(title)}" />`);
  replaceOne(/<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${esc(description)}" />`);
  replaceOne(/<meta name="twitter:image" content="[^"]*"\s*\/>/,
    `<meta name="twitter:image" content="${esc(img)}" />`);

  // Only the default card has known dimensions; drop the declaration otherwise.
  if (!isDefaultImage) {
    out = out.replace(/\s*<meta property="og:image:width" content="[^"]*"\s*\/>/, '')
             .replace(/\s*<meta property="og:image:height" content="[^"]*"\s*\/>/, '');
  }
  if (noindex && !/name="robots"/.test(out)) {
    out = out.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>');
  }
  return out;
}

/** Run `worker` over `items` with bounded concurrency; failures resolve to null. */
async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try { out[i] = await worker(items[i]); } catch { out[i] = null; }
    }
  }));
  return out;
}

async function emit(routePath, html) {
  const dir = path.join(DIST, routePath);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html, 'utf8');
}

async function main() {
  const shellPath = path.join(DIST, 'index.html');
  if (!existsSync(shellPath)) {
    console.error('[prerender] dist/index.html not found — run vite build first.');
    process.exit(1);
  }
  const shell = await readFile(shellPath, 'utf8');

  let products = [];
  let categories = [];
  let posts = [];
  try {
    const [pRes, cRes, bRes] = await Promise.all([
      getJson('/api/catalog/products?limit=1000'),
      getJson('/api/catalog/categories'),
      getJson('/api/blog?limit=500'),
    ]);
    products = pRes.products || [];
    categories = cRes.categories || cRes.data || [];
    posts = bRes.posts || [];
  } catch (err) {
    console.warn(`[prerender] SKIPPED — ${API} unreachable (${err.message}).`);
    console.warn('[prerender] Build continues; routes fall back to the SPA shell.');
    return;
  }

  let count = 0;

  // The list endpoint runs .select('-description'), so the copy that belongs in
  // og:description is not in it. Fetch the detail documents with bounded
  // concurrency; any that fail fall back to a description built from fields we
  // already hold, which is still specific to the product.
  const needDescription = products.filter((p) => p.slug && !p.seo?.description);
  const details = new Map();
  if (needDescription.length) {
    const fetched = await mapLimit(needDescription, 8, async (p) => {
      const r = await getJson(`/api/catalog/products/${encodeURIComponent(p.slug)}`);
      return [p.slug, r.product?.description];
    });
    for (const entry of fetched) if (entry?.[1]) details.set(entry[0], entry[1]);
    console.log(`[prerender] fetched ${details.size}/${needDescription.length} product descriptions`);
  }

  for (const p of products) {
    if (!p.slug) continue;
    const img = p.images?.find((i) => typeof i === 'string' && i.startsWith('http'));
    const fallback = [`Buy ${p.title} online at Macgly.`, p.brand && `Brand: ${p.brand}.`,
      'Genuine product with GST invoice and pan-India delivery.'].filter(Boolean).join(' ');
    await emit(`product/${p.slug}`, applyMeta(shell, {
      title: p.seo?.title || `${p.title} — Macgly`,
      description: p.seo?.description || clamp(details.get(p.slug), 160) || clamp(fallback, 160),
      canonical: `${SITE_URL}/product/${p.slug}`,
      image: img,
      type: 'product',
    }));
    count++;
  }

  for (const c of categories) {
    if (!c.slug) continue;
    await emit(`category/${c.slug}`, applyMeta(shell, {
      title: `${c.name} – Buy Online | Macgly`,
      description: clamp(c.description, 160)
        || `Shop ${c.name} from trusted vendors on Macgly. Genuine products, fast delivery across India.`,
      canonical: `${SITE_URL}/category/${c.slug}`,
      image: typeof c.image === 'string' && c.image.startsWith('http') ? c.image : undefined,
    }));
    count++;
  }

  for (const b of posts) {
    if (!b.slug) continue;
    const img = b.coverImage || b.featuredImage;
    await emit(`blog/${b.slug}`, applyMeta(shell, {
      title: `${b.title} | Macgly Blog`,
      description: clamp(b.excerpt || b.content, 160),
      canonical: `${SITE_URL}/blog/${b.slug}`,
      image: typeof img === 'string' && img.startsWith('http') ? img : undefined,
      type: 'article',
    }));
    count++;
  }

  // Vendor stores: derived from the products already fetched, so this costs no
  // extra requests and only covers vendors that actually have listings.
  const vendors = new Map();
  for (const p of products) {
    const v = p.vendorId;
    if (!v || typeof v !== 'object' || !v._id) continue;
    if (!vendors.has(String(v._id))) vendors.set(String(v._id), v);
  }
  for (const [id, v] of vendors) {
    const name = v.vendorProfile?.storeName || v.vendorProfile?.businessName || v.name || 'Store';
    await emit(`store/${id}`, applyMeta(shell, {
      title: `${name} — Tools & Machinery Store | Macgly`,
      description: clamp(v.vendorProfile?.storeDescription, 160)
        || `Browse tools, machinery and spare parts sold by ${name} on Macgly. Genuine products with pan-India delivery.`,
      canonical: `${SITE_URL}/store/${id}`,
    }));
    count++;
  }

  console.log(`[prerender] wrote ${count} route shells `
    + `(${products.length} products, ${categories.length} categories, ${posts.length} posts, ${vendors.size} stores)`);
}

main().catch((err) => {
  // Never fail the build on a prerender problem.
  console.warn('[prerender] SKIPPED —', err.message);
});
