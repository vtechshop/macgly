const router = require('express').Router();
const FlashSale = require('../models/FlashSale');

// Public: get active flash sales
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const sales = await FlashSale.find({
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now },
    })
      .populate('products.product', 'title slug images price salePrice stock')
      .sort({ endTime: 1 });
    res.json({ flashSales: sales });
  } catch (err) { next(err); }
});

// Public: single flash sale
router.get('/:id', async (req, res, next) => {
  try {
    const sale = await FlashSale.findById(req.params.id)
      .populate('products.product', 'title slug images price salePrice stock category brand');
    if (!sale) return res.status(404).json({ error: { message: 'Not found' } });
    res.json({ flashSale: sale });
  } catch (err) { next(err); }
});

module.exports = router;
