const router = require('express').Router();
const {
  getProducts, getProduct, getCategories, getCategory,
  getBanners, getFeatured,
} = require('../controllers/catalogController');
const { cacheMiddleware } = require('../middleware/cache');
const TTL = require('../config/ttl');
const StockAlert = require('../models/StockAlert');
const Product   = require('../models/Product');
const AppError  = require('../utils/AppError');
const { checkServiceability } = require('../services/delhiveryService');
const { rememberQuote } = require('../utils/shippingQuote');
const { DELHIVERY_API_KEY, DELHIVERY_BASE_URL, DELHIVERY_PICKUP_PINCODE } = require('../config/env');
const axios = require('axios');

router.get('/brands', async (req, res, next) => {
  try {
    const brands = await Product.distinct('brand', { published: true, brand: { $nin: [null, ''] } });
    res.json({ brands: brands.filter(Boolean).sort((a, b) => a.localeCompare(b)) });
  } catch (err) {
    next(err);
  }
});

router.get('/products', cacheMiddleware(TTL.CATALOG), getProducts);
router.get('/products/:slug', cacheMiddleware(TTL.PRODUCT), getProduct);
router.get('/categories', cacheMiddleware(TTL.CATEGORY), getCategories);
router.get('/categories/:slug', cacheMiddleware(TTL.CATEGORY), getCategory);
router.get('/banners', cacheMiddleware(TTL.BANNER), getBanners);
router.get('/featured', cacheMiddleware(TTL.CATALOG), getFeatured);

// GET /catalog/shipping-rates — get live Delhivery rates for a pincode
router.get('/shipping-rates', async (req, res) => {
  const { pincode, weight = '0.5' } = req.query;
  const fallback = [
    { id: 'standard', label: 'Standard Delivery', desc: '3–7 business days', charge: 70 },
    { id: 'express',  label: 'Express Delivery',  desc: '1–2 business days', charge: 120 },
  ];
  if (!pincode || !/^\d{6}$/.test(pincode) || !DELHIVERY_API_KEY) {
    await rememberQuote(pincode, fallback);
    return res.json({ options: fallback });
  }
  try {
    const headers = { Authorization: `Token ${DELHIVERY_API_KEY}` };
    const grams = Math.round(parseFloat(weight) * 1000);
    const origin = DELHIVERY_PICKUP_PINCODE;
    const [surfaceRes, expressRes] = await Promise.all([
      axios.get(`${DELHIVERY_BASE_URL}/api/kinko/v1/invoice/charges/.json?md=S&cgm=${grams}&o_pin=${origin}&d_pin=${pincode}&pt=Pre-paid&ss=Delivered`, { headers }),
      axios.get(`${DELHIVERY_BASE_URL}/api/kinko/v1/invoice/charges/.json?md=E&cgm=${grams}&o_pin=${origin}&d_pin=${pincode}&pt=Pre-paid&ss=Delivered`, { headers }),
    ]);
const standard = Math.ceil(surfaceRes.data?.[0]?.total_amount || 70);
    const express  = Math.ceil(expressRes.data?.[0]?.total_amount || 120);
    const options = [
      { id: 'standard', label: 'Standard Delivery', desc: '3–7 business days', charge: standard },
      { id: 'express',  label: 'Express Delivery',  desc: '1–2 business days', charge: express },
    ];
    // Record what we quoted so checkout can validate the figure it is sent back.
    await rememberQuote(pincode, options);
    res.json({ options });
  } catch (err) {
    console.error('[Delhivery rates error]', err?.response?.status, JSON.stringify(err?.response?.data || err?.message));
    await rememberQuote(pincode, fallback);
    res.json({ options: fallback });
  }
});

// GET /catalog/serviceability/:pincode — check Delhivery delivery availability
router.get('/serviceability/:pincode', async (req, res, next) => {
  try {
    const { pincode } = req.params;
    if (!/^\d{6}$/.test(pincode)) throw new AppError('Invalid pincode', 400, 'INVALID_PINCODE');
    const result = await checkServiceability(pincode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

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
