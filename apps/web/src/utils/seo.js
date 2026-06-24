export function productJsonLd(product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.seo?.description || product.description,
    image: product.images,
    sku: product.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'INR',
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    aggregateRating: product.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    } : undefined,
  };
}

export function injectJsonLd(data) {
  const existing = document.getElementById('json-ld');
  const script = existing || document.createElement('script');
  script.id = 'json-ld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

export function setMeta({ title, description, canonical, image, type = 'website' }) {
  if (title) document.title = title;

  const setTag = (name, content, prop = false) => {
    if (!content) return;
    const attr = prop ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };

  if (description) setTag('description', description);

  // Open Graph
  setTag('og:type',        type,        true);
  setTag('og:site_name',   'Macgly',    true);
  if (title)       setTag('og:title',       title,       true);
  if (description) setTag('og:description', description, true);
  if (canonical)   setTag('og:url',         canonical,   true);
  if (image)       setTag('og:image',       image,       true);
  if (image)       setTag('og:image:width',  '1200',     true);
  if (image)       setTag('og:image:height', '630',      true);

  // Twitter Card
  setTag('twitter:card',        image ? 'summary_large_image' : 'summary', false);
  setTag('twitter:site',        '@macgly',    false);
  if (title)       setTag('twitter:title',       title,       false);
  if (description) setTag('twitter:description', description, false);
  if (image)       setTag('twitter:image',       image,       false);

  if (canonical) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = canonical;
  }
}
