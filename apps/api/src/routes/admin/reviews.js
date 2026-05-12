const router = require('express').Router();
const Review = require('../../models/Review');
const Product = require('../../models/Product');
const AppError = require('../../utils/AppError');

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

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, rating, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (rating) filter.rating = parseInt(rating);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [reviews, total, stats] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email')
        .populate('product', 'title images slug'),
      Review.countDocuments(filter),
      Review.aggregate([
        {
          $facet: {
            total:    [{ $count: 'n' }],
            pending:  [{ $match: { status: 'pending' } }, { $count: 'n' }],
            approved: [{ $match: { status: 'approved' } }, { $count: 'n' }],
            rejected: [{ $match: { status: 'rejected' } }, { $count: 'n' }],
            verified: [{ $match: { verified: true } }, { $count: 'n' }],
            thisWeek: [{ $match: { createdAt: { $gte: sevenDaysAgo } } }, { $count: 'n' }],
            positive: [{ $match: { rating: { $gte: 4 } } }, { $count: 'n' }],
            ratingDist: [{ $group: { _id: '$rating', count: { $sum: 1 } } }],
            avgRating:  [{ $group: { _id: null, avg: { $avg: '$rating' } } }],
          },
        },
      ]),
    ]);

    const s = stats[0] || {};
    const n = (arr) => arr?.[0]?.n || 0;
    const totalCount = n(s.total);
    const positiveCount = n(s.positive);
    const dist = {};
    (s.ratingDist || []).forEach((r) => { dist[r._id] = r.count; });

    // client-side search filter
    let filtered = reviews;
    if (search) {
      const q = search.toLowerCase();
      filtered = reviews.filter((r) =>
        r.product?.title?.toLowerCase().includes(q) ||
        r.user?.name?.toLowerCase().includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        r.body?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q)
      );
    }

    res.json({
      reviews: filtered,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
      stats: {
        total: totalCount,
        pending: n(s.pending),
        approved: n(s.approved),
        rejected: n(s.rejected),
        verified: n(s.verified),
        thisWeek: n(s.thisWeek),
        positiveRate: totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0,
        avgRating: s.avgRating?.[0]?.avg ? Math.round(s.avgRating[0].avg * 10) / 10 : 0,
        ratingDist: dist,
      },
    });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { status, verified } = req.body;
    const update = {};
    if (status) update.status = status;
    if (verified !== undefined) update.verified = verified;

    const review = await Review.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
    await recalcProduct(review.product);
    res.json({ review });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
    await recalcProduct(review.product);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
