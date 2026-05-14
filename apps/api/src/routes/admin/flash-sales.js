const router = require('express').Router();
const FlashSale = require('../../models/FlashSale');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const sales = await FlashSale.find()
      .populate('products.product', 'title sku images price')
      .sort({ startTime: -1 });
    res.json({ flashSales: sales });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, banner, startTime, endTime, products } = req.body;
    if (!title || !startTime || !endTime) throw new AppError('title, startTime, endTime required', 400, 'MISSING_FIELDS');
    const sale = await FlashSale.create({ title, description, banner, startTime, endTime, products: products || [] });
    res.status(201).json({ flashSale: sale });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const sale = await FlashSale.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sale) throw new AppError('Flash sale not found', 404, 'NOT_FOUND');
    res.json({ flashSale: sale });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await FlashSale.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
