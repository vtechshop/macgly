const router = require('express').Router();
const AdCampaign = require('../../models/AdCampaign');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [campaigns, total] = await Promise.all([
      AdCampaign.find(filter)
        .populate('vendor', 'name email')
        .populate('product', 'title images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AdCampaign.countDocuments(filter),
    ]);
    res.json({ campaigns, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const campaign = await AdCampaign.findByIdAndUpdate(
      req.params.id,
      { status, ...(adminNote && { adminNote }) },
      { new: true }
    );
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    res.json({ campaign });
  } catch (err) { next(err); }
});

module.exports = router;
