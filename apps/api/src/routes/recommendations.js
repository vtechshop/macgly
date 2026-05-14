const router = require('express').Router();
const Product = require('../models/Product');

// GET /api/recommendations?productId=xxx&category=xxx&limit=8
router.get('/', async (req, res, next) => {
  try {
    const { productId, category, brand, limit = 8 } = req.query;
    const filter = { published: true, stock: { $gt: 0 } };
    if (productId) filter._id = { $ne: productId };
    if (category) filter.category = category;
    if (brand) filter.brand = brand;

    let products = await Product.find(filter)
      .select('title slug images price salePrice stock category brand rating')
      .sort({ rating: -1, createdAt: -1 })
      .limit(parseInt(limit));

    // If not enough from same category, fill with popular
    if (products.length < parseInt(limit) && category) {
      const ids = products.map((p) => p._id);
      const more = await Product.find({ published: true, stock: { $gt: 0 }, _id: { $nin: ids, ...(productId ? { $ne: productId } : {}) } })
        .select('title slug images price salePrice stock category brand rating')
        .sort({ rating: -1 })
        .limit(parseInt(limit) - products.length);
      products = [...products, ...more];
    }

    res.json({ products });
  } catch (err) { next(err); }
});

module.exports = router;
