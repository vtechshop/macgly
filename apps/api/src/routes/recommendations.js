const router = require('express').Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const mongoose = require('mongoose');

// GET /api/recommendations?productId=xxx&category=xxx&categoryId=xxx&limit=8
router.get('/', async (req, res, next) => {
  try {
    const { productId, category, categoryId, brand, limit = 8 } = req.query;
    const filter = { published: true, stock: { $gt: 0 } };
    if (productId && mongoose.Types.ObjectId.isValid(productId)) filter._id = { $ne: productId };
    if (brand) filter.brand = brand;

    // Build category filter: prefer categoryId (ObjectId), fall back to slug string
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      filter.$or = [{ categoryIds: categoryId }, { category: { $exists: true } }];
      // narrow to just categoryIds match first
      filter.$or = [{ categoryIds: categoryId }];
      // also include legacy string if a slug exists for this id
      const catDoc = await Category.findById(categoryId).select('slug');
      if (catDoc) filter.$or = [{ categoryIds: categoryId }, { category: catDoc.slug }];
    } else if (category) {
      const catDoc = await Category.findOne({ slug: category.toLowerCase() }).select('_id');
      if (catDoc) {
        filter.$or = [{ category: category.toLowerCase() }, { categoryIds: catDoc._id }];
      } else {
        filter.category = category.toLowerCase();
      }
    }

    let products = await Product.find(filter)
      .select('title slug images price compareAt stock category brand rating')
      .sort({ rating: -1, createdAt: -1 })
      .limit(parseInt(limit));

    // Fill with popular products if not enough from same category
    if (products.length < parseInt(limit)) {
      const ids = products.map((p) => p._id);
      const excludeIds = productId && mongoose.Types.ObjectId.isValid(productId)
        ? [...ids, new mongoose.Types.ObjectId(productId)]
        : ids;
      const more = await Product.find({ published: true, stock: { $gt: 0 }, _id: { $nin: excludeIds } })
        .select('title slug images price compareAt stock category brand rating')
        .sort({ rating: -1 })
        .limit(parseInt(limit) - products.length);
      products = [...products, ...more];
    }

    res.json({ products });
  } catch (err) { next(err); }
});

module.exports = router;
