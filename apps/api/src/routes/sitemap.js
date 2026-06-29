const router = require('express').Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Blog = require('../models/Blog');

const BASE_URL = process.env.FRONTEND_URL || 'https://www.macgly.com';

const STATIC_ROUTES = [
  { path: '/',                  priority: '1.0', changefreq: 'daily' },
  { path: '/products',          priority: '0.9', changefreq: 'daily' },
  { path: '/categories',        priority: '0.8', changefreq: 'weekly' },
  { path: '/blog',              priority: '0.8', changefreq: 'daily' },
  { path: '/track-order',       priority: '0.7', changefreq: 'monthly' },
  { path: '/warranty-check',    priority: '0.6', changefreq: 'monthly' },
  { path: '/sell',              priority: '0.7', changefreq: 'monthly' },
  { path: '/affiliate',         priority: '0.6', changefreq: 'monthly' },
  { path: '/info/about',        priority: '0.6', changefreq: 'monthly' },
  { path: '/info/contact',      priority: '0.6', changefreq: 'monthly' },
  { path: '/info/privacy',      priority: '0.3', changefreq: 'yearly' },
  { path: '/info/terms',        priority: '0.3', changefreq: 'yearly' },
];

function urlTag({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

router.get('/', async (req, res, next) => {
  try {
    const [products, categories, posts] = await Promise.all([
      Product.find({ published: true }).select('slug updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
      Blog.find({ status: 'published' }).select('slug updatedAt').lean(),
    ]);

    const now = new Date().toISOString();

    const urls = [
      ...STATIC_ROUTES.map(({ path, priority, changefreq }) =>
        urlTag({ loc: `${BASE_URL}${path}`, changefreq, priority, lastmod: now })
      ),
      ...categories.map((c) =>
        urlTag({ loc: `${BASE_URL}/category/${c.slug}`, changefreq: 'daily', priority: '0.8', lastmod: c.updatedAt?.toISOString() })
      ),
      ...products.map((p) =>
        urlTag({ loc: `${BASE_URL}/product/${p.slug}`, changefreq: 'weekly', priority: '0.7', lastmod: p.updatedAt?.toISOString() })
      ),
      ...posts.map((p) =>
        urlTag({ loc: `${BASE_URL}/blog/${p.slug}`, changefreq: 'monthly', priority: '0.6', lastmod: p.updatedAt?.toISOString() })
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
