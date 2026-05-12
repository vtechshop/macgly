const router = require('express').Router();
const {
  getProducts, getProduct, getCategories, getCategory,
  getBanners, getFeatured,
} = require('../controllers/catalogController');
const { cacheMiddleware } = require('../middleware/cache');
const TTL = require('../config/ttl');

router.get('/products', cacheMiddleware(TTL.CATALOG), getProducts);
router.get('/products/:slug', cacheMiddleware(TTL.PRODUCT), getProduct);
router.get('/categories', cacheMiddleware(TTL.CATEGORY), getCategories);
router.get('/categories/:slug', cacheMiddleware(TTL.CATEGORY), getCategory);
router.get('/banners', cacheMiddleware(TTL.BANNER), getBanners);
router.get('/featured', cacheMiddleware(TTL.CATALOG), getFeatured);

module.exports = router;
