// Canonical origin. Deliberately hard-coded rather than read from
// window.location.origin: render.yaml builds the SPA and the API serves it, so
// the same pages also answer on macgly.onrender.com. Deriving the origin there
// would make that host declare itself canonical and compete with www.macgly.com.
export const SITE_URL = 'https://www.macgly.com';

// Matches the 1200x630 card in index.html. Used whenever a page has no image of
// its own, so a social share never falls back to the previous page's picture.
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export function productJsonLd(product) {
  const url = `${SITE_URL}/product/${product.slug}`;
  const sellerName = product.vendorId?.vendorProfile?.storeName
    || product.vendorId?.vendorProfile?.businessName
    || product.vendorId?.name;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.seo?.description || product.description,
    image: product.images,
    sku: product.sku,
    url,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: {
      '@type': 'Offer',
      url,
      price: product.price,
      priceCurrency: 'INR',
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      // The listing vendor is the seller of record on this marketplace.
      seller: { '@type': 'Organization', name: sellerName || 'Macgly' },
      // Deliberately NOT emitted: shippingDetails and hasMerchantReturnPolicy.
      // Shipping is a live per-pincode Delhivery rate with per-product
      // overrides, so there is no flat figure that would be true; and the
      // published return window (7 days, /info/faq) contradicts the one the API
      // enforces (30 days, routes/returns.js). Declaring either as structured
      // data would be a claim the site does not honour. Google shows a warning
      // for the omission — that is the correct trade against a false statement.
    },
    aggregateRating: product.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    } : undefined,
  };
}

/**
 * BreadcrumbList mirroring the <nav> breadcrumb the page already renders.
 * @param {Array<{name: string, path?: string}>} trail last item = current page
 */
export function breadcrumbJsonLd(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: `${SITE_URL}${c.path}` } : {}),
    })),
  };
}

export function articleJsonLd(post) {
  const img = post.coverImage || post.featuredImage;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || undefined,
    image: img ? [img] : undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt || post.publishedAt || post.createdAt,
    author: { '@type': post.author?.name ? 'Person' : 'Organization', name: post.author?.name || 'Macgly' },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
  };
}

/** @param {Array<{q: string, a: string}>} items */
export function faqJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

/**
 * Write the page-level JSON-LD. Accepts one object or several; several are
 * combined into a single @graph so there is still exactly one #json-ld element
 * for removeJsonLd() to clear on navigation.
 */
export function injectJsonLd(data) {
  const items = (Array.isArray(data) ? data : [data]).filter(Boolean);
  if (!items.length) { removeJsonLd(); return; }
  const payload = items.length === 1
    ? items[0]
    : {
      '@context': 'https://schema.org',
      '@graph': items.map(({ '@context': _ctx, ...rest }) => rest),
    };
  const existing = document.getElementById('json-ld');
  const script = existing || document.createElement('script');
  script.id = 'json-ld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(payload);
  if (!existing) document.head.appendChild(script);
}

export function removeJsonLd() {
  document.getElementById('json-ld')?.remove();
}

/**
 * Set the per-route head tags.
 *
 * This is a single-page app: the <head> written by index.html is reused for
 * every route, and nothing here used to be cleared on navigation. A visitor who
 * went from a product page to /track-order kept the product's canonical URL and
 * photo, and every route that omitted `canonical` inherited the homepage's —
 * telling Google that page is a duplicate of the homepage. So every tag this
 * function owns is now written on every call, with a default, never skipped.
 *
 * @param {string}  [canonical]  Absolute URL. Defaults to SITE_URL + the current
 *                               path with the query string dropped, which is what
 *                               collapses /products?sort=x&page=2 onto /products.
 * @param {boolean} [noindex]    For pages that must never be indexed.
 */
export function setMeta({ title, description, canonical, image, type = 'website', noindex = false }) {
  if (title) document.title = title;

  const url = canonical || `${SITE_URL}${window.location.pathname}`;
  const ogImage = image || DEFAULT_OG_IMAGE;
  const isDefaultImage = ogImage === DEFAULT_OG_IMAGE;

  // content === null removes the tag. A page with no description must not keep
  // the previous page's.
  const setTag = (name, content, prop = false) => {
    const attr = prop ? 'property' : 'name';
    const el = document.querySelector(`meta[${attr}="${name}"]`);
    if (content === null || content === undefined || content === '') { el?.remove(); return; }
    const tag = el || document.createElement('meta');
    if (!el) { tag.setAttribute(attr, name); document.head.appendChild(tag); }
    tag.setAttribute('content', content);
  };

  setTag('description', description ?? null);
  setTag('robots', noindex ? 'noindex, nofollow' : null);

  // Open Graph
  setTag('og:type',        type,           true);
  setTag('og:site_name',   'Macgly',       true);
  setTag('og:title',       title ?? null,       true);
  setTag('og:description', description ?? null, true);
  setTag('og:url',         url,            true);
  setTag('og:image',       ogImage,        true);
  setTag('og:image:alt',   isDefaultImage ? 'Macgly — Tools & Machinery' : (title || 'Macgly'), true);
  // Only the default card has known dimensions. Declaring 1200x630 for an
  // arbitrary product photo made scrapers letterbox or drop the preview.
  setTag('og:image:width',  isDefaultImage ? '1200' : null, true);
  setTag('og:image:height', isDefaultImage ? '630'  : null, true);

  // Twitter Card
  setTag('twitter:card',        'summary_large_image');
  setTag('twitter:site',        '@macgly');
  setTag('twitter:title',       title ?? null);
  setTag('twitter:description', description ?? null);
  setTag('twitter:image',       ogImage);

  let link = document.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = url;

  // Product JSON-LD belongs to one route only. Product.jsx calls setMeta before
  // injectJsonLd, so clearing here does not race its own injection.
  removeJsonLd();
}
