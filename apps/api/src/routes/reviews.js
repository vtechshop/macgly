const router = require('express').Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { authenticate, optionalAuth } = require('../middleware/auth');
const AppError = require('../utils/AppError');

async function recalcProduct(productId) {
  try {
    const agg = await Review.aggregate([
      { $match: { product: productId, status: { $ne: 'rejected' } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await Product.findByIdAndUpdate(productId, {
      rating: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0,
      reviewCount: agg[0]?.count || 0,
    });
  } catch (_) {}
}

// Get reviews for a product
router.get('/product/:productId', optionalAuth, async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!require('mongoose').Types.ObjectId.isValid(productId)) {
      return res.json({ reviews: [], pagination: { page: 1, total: 0, pages: 0 }, hasReviewed: false, hasPurchased: false });
    }
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total, existingReview, purchase] = await Promise.all([
      Review.find({ product: productId, status: { $in: ['approved', 'pending'] } })
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      Review.countDocuments({ product: productId, status: { $in: ['approved', 'pending'] } }),
      req.user ? Review.findOne({ product: productId, user: req.user._id }) : Promise.resolve(null),
      req.user
        ? Order.findOne({ user: req.user._id, status: 'delivered', 'items.product': productId })
        : Promise.resolve(null),
    ]);

    const isAdmin = req.user?.role === 'admin';

    res.json({
      reviews,
      pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) },
      hasReviewed: !!existingReview,
      hasPurchased: isAdmin || !!purchase,
    });
  } catch (err) { next(err); }
});

// Submit a review
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { productId, rating, title, body } = req.body;
    if (!productId || !rating) throw new AppError('productId and rating required', 400, 'MISSING_FIELDS');

    const isAdmin = req.user.role === 'admin';

    // Non-admin must have a delivered order containing this product
    let verified = false;
    if (!isAdmin) {
      const purchase = await Order.findOne({
        user: req.user._id,
        status: 'delivered',
        'items.product': productId,
      });
      if (!purchase) throw new AppError('You can only review products you have purchased and received', 403, 'NOT_PURCHASED');
      verified = true;
    }

    const existing = await Review.findOne({ product: productId, user: req.user._id });
    if (existing) throw new AppError('You have already reviewed this product', 409, 'DUPLICATE_REVIEW');

    let review;
    try {
      review = await Review.create({
        product: productId,
        user: req.user._id,
        rating,
        title,
        body,
        verified,
        status: 'approved',
      });
    } catch (dbErr) {
      if (dbErr.code === 11000) throw new AppError('You have already reviewed this product', 409, 'DUPLICATE_REVIEW');
      throw dbErr;
    }
    await review.populate('user', 'name');
    await recalcProduct(review.product);

    res.status(201).json({ review });
  } catch (err) { next(err); }
});

// Delete own review
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, user: req.user._id };
    const review = await Review.findOneAndDelete(filter);
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
    await recalcProduct(review.product);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
