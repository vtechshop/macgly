const router = require('express').Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Blog = require('../models/Blog');

const BASE_URL = process.env.FRONTEND_URL || 'https://macgly.com';

router.get('/', async (req, res, next) => {
  try {
    const [products, categories, posts] = await Promise.all([
      Product.find({ status: 'approved' }).select('slug updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
      Blog.find({ status: 'published' }).select('slug updatedAt').lean(),
    ]);

    const staticRoutes = ['/', '/products', '/blog', '/track-order', '/warranty-check', '/sell', '/affiliate', '/info/about', '/info/contact', '/info/privacy', '/info/terms'];

    const urls = [
      ...staticRoutes.map((path) => ({ loc: `${BASE_URL}${path}`, changefreq: 'weekly', priority: path === '/' ? '1.0' : '0.7' })),
      ...categories.map((c) => ({ loc: `${BASE_URL}/category/${c.slug}`, changefreq: 'daily', priority: '0.8', lastmod: c.updatedAt?.toISOString() })),
      ...products.map((p) => ({ loc: `${BASE_URL}/product/${p.slug}`, changefreq: 'weekly', priority: '0.6', lastmod: p.updatedAt?.toISOString() })),
      ...posts.map((p) => ({ loc: `${BASE_URL}/blog/${p.slug}`, changefreq: 'monthly', priority: '0.5', lastmod: p.updatedAt?.toISOString() })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
