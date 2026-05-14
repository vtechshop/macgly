const router = require('express').Router();
const Warranty = require('../../models/Warranty');
const AppError = require('../../utils/AppError');

// List all warranties / claims
router.get('/', async (req, res, next) => {
  try {
    const { status, claimStatus, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (claimStatus) filter['claims.status'] = claimStatus;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [warranties, total] = await Promise.all([
      Warranty.find(filter)
        .populate('user', 'name email')
        .populate('product', 'title sku')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Warranty.countDocuments(filter),
    ]);
    res.json({ warranties, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// Update warranty status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const warranty = await Warranty.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    res.json({ warranty });
  } catch (err) { next(err); }
});

// Update a specific claim within a warranty
router.patch('/:id/claims/:claimId', async (req, res, next) => {
  try {
    const { status, resolution } = req.body;
    const warranty = await Warranty.findById(req.params.id);
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    const claim = warranty.claims.id(req.params.claimId);
    if (!claim) throw new AppError('Claim not found', 404, 'NOT_FOUND');
    if (status) claim.status = status;
    if (resolution) claim.resolution = resolution;
    if (['approved', 'rejected', 'resolved'].includes(status)) claim.resolvedAt = new Date();
    await warranty.save();
    res.json({ warranty });
  } catch (err) { next(err); }
});

module.exports = router;
