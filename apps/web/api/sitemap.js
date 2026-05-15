const BASE = 'https://macgly.com';
const API = 'https://macgly.onrender.com';

const STATIC = [
  ['/', '1.0', 'daily'],
  ['/products', '0.8', 'daily'],
  ['/blog', '0.7', 'weekly'],
  ['/track-order', '0.5', 'monthly'],
  ['/warranty-check', '0.5', 'monthly'],
  ['/sell', '0.6', 'monthly'],
  ['/info/about', '0.4', 'monthly'],
  ['/info/contact', '0.4', 'monthly'],
];

function url(loc, priority, changefreq, lastmod) {
  return `  <url>
    <loc>${loc}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>\n    ` : ''}<changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

module.exports = async (req, res) => {
  try {
    const [catRes, prodRes, blogRes] = await Promise.allSettled([
      fetch(`${API}/api/catalog/categories`).then(r => r.json()),
      fetch(`${API}/api/catalog/products?limit=500&status=approved`).then(r => r.json()),
      fetch(`${API}/api/blog?limit=200`).then(r => r.json()),
    ]);

    const categories = catRes.status === 'fulfilled' ? (catRes.value.categories || []) : [];
    const products   = prodRes.status === 'fulfilled' ? (prodRes.value.products   || []) : [];
    const posts      = blogRes.status === 'fulfilled' ? (blogRes.value.posts      || []) : [];

    const urls = [
      ...STATIC.map(([path, pri, freq]) => url(`${BASE}${path}`, pri, freq)),
      ...categories.map(c => url(`${BASE}/category/${c.slug}`, '0.8', 'daily', c.updatedAt?.slice(0, 10))),
      ...products.map(p => url(`${BASE}/product/${p.slug}`, '0.6', 'weekly', p.updatedAt?.slice(0, 10))),
      ...posts.map(p => url(`${BASE}/blog/${p.slug}`, '0.5', 'monthly', p.updatedAt?.slice(0, 10))),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.send(xml);
  } catch (err) {
    res.status(500).send('Sitemap generation failed');
  }
};
