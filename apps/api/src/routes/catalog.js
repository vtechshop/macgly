const router = require('express').Router();
const {
  getProducts, getProduct, getCategories, getCategory,
  getBanners, getFeatured,
} = require('../controllers/catalogController');
const { cacheMiddleware } = require('../middleware/cache');
const TTL = require('../config/ttl');
const StockAlert = require('../models/StockAlert');
const AppError  = require('../utils/AppError');

router.get('/products', cacheMiddleware(TTL.CATALOG), getProducts);
router.get('/products/:slug', cacheMiddleware(TTL.PRODUCT), getProduct);
router.get('/categories', cacheMiddleware(TTL.CATEGORY), getCategories);
router.get('/categories/:slug', cacheMiddleware(TTL.CATEGORY), getCategory);
router.get('/banners', cacheMiddleware(TTL.BANNER), getBanners);
router.get('/featured', cacheMiddleware(TTL.CATALOG), getFeatured);

// POST /catalog/stock-alert — subscribe for back-in-stock notification
router.post('/stock-alert', async (req, res, next) => {
  try {
    const { email, productId } = req.body;
    if (!email || !productId) throw new AppError('email and productId are required', 400, 'MISSING_FIELDS');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Invalid email address', 400, 'INVALID_EMAIL');
    await StockAlert.findOneAndUpdate(
      { email: email.toLowerCase().trim(), productId },
      { $setOnInsert: { email: email.toLowerCase().trim(), productId, notifiedAt: null } },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
