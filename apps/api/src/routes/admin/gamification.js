const router = require('express').Router();
const SpinConfig = require('../../models/SpinConfig');
const SpinHistory = require('../../models/SpinHistory');
const QuizQuestion = require('../../models/QuizQuestion');
const QuizAttempt = require('../../models/QuizAttempt');
const AppConfig = require('../../models/AppConfig');
const AppError = require('../../utils/AppError');

// ─── Spin Config ──────────────────────────────────────────────────────────────
router.get('/spin', async (req, res, next) => {
  try {
    const config = await SpinConfig.findOne() || { isEnabled: false, dailySpinsPerUser: 1, slices: [] };
    res.json({ config });
  } catch (err) { next(err); }
});

router.put('/spin', async (req, res, next) => {
  try {
    const { isEnabled, dailySpinsPerUser, spinsOnRegister, slices } = req.body;
    const config = await SpinConfig.findOneAndUpdate(
      {},
      { isEnabled, dailySpinsPerUser, spinsOnRegister, slices },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ config });
  } catch (err) { next(err); }
});

router.get('/spin/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const total = await SpinHistory.countDocuments();
    const history = await SpinHistory.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ history, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// ─── Quiz Questions ───────────────────────────────────────────────────────────
router.get('/quiz', async (req, res, next) => {
  try {
    const questions = await QuizQuestion.find().sort({ createdAt: -1 });
    res.json({ questions });
  } catch (err) { next(err); }
});

router.post('/quiz', async (req, res, next) => {
  try {
    const { question, options, category, difficulty, pointsOnCorrect } = req.body;
    if (!question || !options?.length) return next(new AppError('Question and options are required', 400));
    const q = await QuizQuestion.create({ question, options, category, difficulty, pointsOnCorrect });
    res.status(201).json({ question: q });
  } catch (err) { next(err); }
});

router.put('/quiz/:id', async (req, res, next) => {
  try {
    const q = await QuizQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!q) return next(new AppError('Question not found', 404));
    res.json({ question: q });
  } catch (err) { next(err); }
});

router.delete('/quiz/:id', async (req, res, next) => {
  try {
    await QuizQuestion.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ─── Loyalty Config ───────────────────────────────────────────────────────────
router.get('/loyalty-config', async (req, res, next) => {
  try {
    const keys = ['loyalty_points_per_rupee', 'loyalty_rupee_per_point', 'loyalty_min_redeem'];
    const configs = await AppConfig.find({ key: { $in: keys } });
    const result = {};
    configs.forEach((c) => { result[c.key] = c.value; });
    res.json({ config: result });
  } catch (err) { next(err); }
});

router.put('/loyalty-config', async (req, res, next) => {
  try {
    const { loyalty_points_per_rupee, loyalty_rupee_per_point, loyalty_min_redeem } = req.body;
    const updates = { loyalty_points_per_rupee, loyalty_rupee_per_point, loyalty_min_redeem };
    await Promise.all(
      Object.entries(updates)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => AppConfig.findOneAndUpdate({ key }, { key, value, type: 'number' }, { upsert: true }))
    );
    res.json({ message: 'Loyalty config updated' });
  } catch (err) { next(err); }
});

module.exports = router;
