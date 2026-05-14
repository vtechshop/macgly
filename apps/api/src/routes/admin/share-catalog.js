const router = require('express').Router();
const crypto = require('crypto');
const Product = require('../../models/Product');
const AppConfig = require('../../models/AppConfig');

// GET /admin/share-catalog — list active share links
router.get('/', async (req, res, next) => {
  try {
    const cfg = await AppConfig.findOne({ key: 'catalog_shares' });
    const shares = cfg?.value || [];
    res.json({ shares });
  } catch (err) { next(err); }
});

// POST /admin/share-catalog — generate a new share link
router.post('/', async (req, res, next) => {
  try {
    const { label = 'Catalog', categoryFilter, expiresInDays = 30 } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const entry = { token, label, categoryFilter: categoryFilter || null, expiresAt, createdAt: new Date() };

    await AppConfig.findOneAndUpdate(
      { key: 'catalog_shares' },
      { $push: { value: entry } },
      { upsert: true, new: true }
    );
    res.json({ token, expiresAt });
  } catch (err) { next(err); }
});

// DELETE /admin/share-catalog/:token — revoke a share link
router.delete('/:token', async (req, res, next) => {
  try {
    await AppConfig.findOneAndUpdate(
      { key: 'catalog_shares' },
      { $pull: { value: { token: req.params.token } } }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Public: GET /catalog/:token (no auth) — expose via public router, not admin
// This route is for preview within admin context
router.get('/preview/:token', async (req, res, next) => {
  try {
    const cfg = await AppConfig.findOne({ key: 'catalog_shares' });
    const shares = cfg?.value || [];
    const share = shares.find((s) => s.token === req.params.token && new Date(s.expiresAt) > new Date());
    if (!share) return res.status(404).json({ error: { message: 'Link not found or expired' } });

    const filter = { published: true };
    if (share.categoryFilter) filter.category = share.categoryFilter;
    const products = await Product.find(filter).select('title sku price salePrice images category brand stock').limit(200);
    res.json({ label: share.label, products });
  } catch (err) { next(err); }
});

module.exports = router;
