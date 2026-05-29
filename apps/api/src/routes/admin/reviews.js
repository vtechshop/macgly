const router = require('express').Router();
const Review = require('../../models/Review');
const Product = require('../../models/Product');
const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');

async function recalcProduct(productId) {
  try {
    const agg = await Review.aggregate([
      { $match: { product: productId, status: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await Product.findByIdAndUpdate(productId, {
      rating: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0,
      reviewCount: agg[0]?.count || 0,
    });
  } catch (_) {}
}

// GET /stats
router.get('/stats', async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      total, pending, approved, rejected, verified, withResponse, thisWeek,
      ratingDistRaw, avgRatingRaw, helpfulRaw,
    ] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ status: 'pending' }),
      Review.countDocuments({ status: 'approved' }),
      Review.countDocuments({ status: 'rejected' }),
      Review.countDocuments({ verified: true }),
      Review.countDocuments({ 'vendorResponse.text': { $exists: true, $ne: '' } }),
      Review.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Review.aggregate([{ $group: { _id: '$rating', count: { $sum: 1 } } }]),
      Review.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ]),
      Review.aggregate([{ $group: { _id: null, total: { $sum: '$helpfulCount' } } }]),
    ]);

    const dist = {};
    ratingDistRaw.forEach((r) => { dist[r._id] = r.count; });
    const positiveCount = (dist[4] || 0) + (dist[5] || 0);

    res.json({
      total,
      pending,
      approved,
      rejected,
      verified,
      withResponse,
      thisWeek,
      avgRating: avgRatingRaw[0] ? Math.round(avgRatingRaw[0].avg * 10) / 10 : 0,
      ratingDist: dist,
      totalHelpful: helpfulRaw[0]?.total || 0,
      responseRate: total > 0 ? Math.round((withResponse / total) * 100) : 0,
      positiveRate: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
    });
  } catch (err) { next(err); }
});

// POST /bulk-update
router.post('/bulk-update', async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!ids?.length) throw new AppError('No IDs provided', 400, 'MISSING_IDS');

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    if (status === 'delete') {
      const reviews = await Review.find({ _id: { $in: objectIds } }, { product: 1, status: 1 });
      await Review.deleteMany({ _id: { $in: objectIds } });
      const affectedProducts = [...new Set(
        reviews.filter((r) => r.status === 'approved').map((r) => r.product.toString()),
      )];
      await Promise.all(affectedProducts.map((pid) => recalcProduct(new mongoose.Types.ObjectId(pid))));
    } else {
      const reviews = await Review.find({ _id: { $in: objectIds } }, { product: 1, status: 1 });
      await Review.updateMany({ _id: { $in: objectIds } }, { status });
      const affectedProducts = [...new Set(
        reviews
          .filter((r) => r.status === 'approved' || status === 'approved')
          .map((r) => r.product.toString()),
      )];
      await Promise.all(affectedProducts.map((pid) => recalcProduct(new mongoose.Types.ObjectId(pid))));
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET / - paginated list with filters and server-side search
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, rating, search, verified, hasResponse } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const baseFilter = {};
    if (status) baseFilter.status = status;
    if (rating) baseFilter.rating = parseInt(rating);
    if (verified === 'true') baseFilter.verified = true;
    else if (verified === 'false') baseFilter.verified = false;
    if (hasResponse === 'true') baseFilter['vendorResponse.text'] = { $exists: true, $ne: '' };

    let reviews, total;

    if (search) {
      const q = search.trim();
      const pipeline = [
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: '_product',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: '_user',
          },
        },
        {
          $match: {
            ...baseFilter,
            $or: [
              { body: { $regex: q, $options: 'i' } },
              { title: { $regex: q, $options: 'i' } },
              { '_product.title': { $regex: q, $options: 'i' } },
              { '_user.name': { $regex: q, $options: 'i' } },
              { '_user.email': { $regex: q, $options: 'i' } },
            ],
          },
        },
        {
          $facet: {
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: parseInt(limit) },
              {
                $addFields: {
                  product: { $arrayElemAt: ['$_product', 0] },
                  user: {
                    $let: {
                      vars: { u: { $arrayElemAt: ['$_user', 0] } },
                      in: { _id: '$$u._id', name: '$$u.name', email: '$$u.email' },
                    },
                  },
                },
              },
              { $project: { _product: 0, _user: 0 } },
            ],
            count: [{ $count: 'n' }],
          },
        },
      ];
      const result = await Review.aggregate(pipeline);
      reviews = result[0]?.data || [];
      total = result[0]?.count?.[0]?.n || 0;
    } else {
      [reviews, total] = await Promise.all([
        Review.find(baseFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('user', 'name email')
          .populate('product', 'title images slug'),
        Review.countDocuments(baseFilter),
      ]);
    }

    res.json({
      reviews,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) { next(err); }
});

// GET /:id
router.get('/:id', async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name email')
      .populate('product', 'title images slug');
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
    res.json({ review });
  } catch (err) { next(err); }
});

// PUT /:id/status
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }
    const review = await Review.findById(req.params.id);
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

    const oldStatus = review.status;
    review.status = status;
    if (status === 'rejected' && rejectionReason) review.rejectionReason = rejectionReason;
    await review.save();

    if (oldStatus !== status && (oldStatus === 'approved' || status === 'approved')) {
      await recalcProduct(review.product);
    }

    res.json({ review });
  } catch (err) { next(err); }
});

// PUT /:id/respond
router.put('/:id/respond', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 10) {
      throw new AppError('Response must be at least 10 characters', 400, 'INVALID_RESPONSE');
    }
    const review = await Review.findById(req.params.id);
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

    review.vendorResponse = {
      text: text.trim(),
      respondedAt: new Date(),
      respondedBy: req.user._id,
    };
    await review.save();
    res.json({ review });
  } catch (err) { next(err); }
});

// PUT /:id (legacy - kept for backward compat)
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

// DELETE /:id
router.delete('/:id', async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
    if (review.status === 'approved') await recalcProduct(review.product);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
