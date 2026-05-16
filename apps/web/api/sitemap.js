const https = require('https');

const BASE = 'https://macgly.com';
const API  = 'https://macgly.onrender.com';

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

function get(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
    }).on('error', () => resolve({}));
  });
}

function urlTag(loc, priority, changefreq, lastmod) {
  return `  <url>
    <loc>${loc}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>\n    ` : ''}<changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

module.exports = async (req, res) => {
  const [catData, prodData, blogData] = await Promise.all([
    get(`${API}/api/catalog/categories`),
    get(`${API}/api/catalog/products?limit=500`),
    get(`${API}/api/blog?limit=200`),
  ]);

  const categories = catData.categories  || [];
  const products   = prodData.products   || [];
  const posts      = blogData.posts      || [];

  const urls = [
    ...STATIC.map(([path, pri, freq]) => urlTag(`${BASE}${path}`, pri, freq)),
    ...categories.map(c => urlTag(`${BASE}/category/${c.slug}`, '0.8', 'daily',   c.updatedAt?.slice(0, 10))),
    ...products.map(p   => urlTag(`${BASE}/product/${p.slug}`,  '0.6', 'weekly',  p.updatedAt?.slice(0, 10))),
    ...posts.map(p      => urlTag(`${BASE}/blog/${p.slug}`,     '0.5', 'monthly', p.updatedAt?.slice(0, 10))),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.end(xml);
};
