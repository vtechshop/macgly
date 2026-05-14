const router = require('express').Router();
const Return = require('../../models/Return');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [returns, total] = await Promise.all([
      Return.find(filter)
        .populate('user', 'name email')
        .populate('order', 'orderId totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Return.countDocuments(filter),
    ]);
    res.json({ returns, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, adminNote, refundAmount } = req.body;
    const update = { status, ...(adminNote && { adminNote }), ...(refundAmount !== undefined && { refundAmount }) };
    if (['approved', 'rejected', 'refunded'].includes(status)) update.resolvedAt = new Date();
    const ret = await Return.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name email')
      .populate('order', 'orderId');
    if (!ret) throw new AppError('Return not found', 404, 'NOT_FOUND');
    res.json({ return: ret });
  } catch (err) { next(err); }
});

module.exports = router;
