const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const SpinConfig = require('../models/SpinConfig');
const SpinHistory = require('../models/SpinHistory');
const QuizQuestion = require('../models/QuizQuestion');
const QuizAttempt = require('../models/QuizAttempt');
const Loyalty = require('../models/Loyalty');
const AppError = require('../utils/AppError');

// ─── Spin-to-win ─────────────────────────────────────────────────────────────

router.get('/spin/config', async (req, res, next) => {
  try {
    const config = await SpinConfig.findOne();
    res.json({ config: config || { isEnabled: false, slices: [] } });
  } catch (err) { next(err); }
});

router.post('/spin', authenticate, async (req, res, next) => {
  try {
    const config = await SpinConfig.findOne();
    if (!config?.isEnabled) return next(new AppError('Spin is not available', 400));

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySpins = await SpinHistory.countDocuments({ user: req.user._id, createdAt: { $gte: today } });
    if (todaySpins >= (config.dailySpinsPerUser || 1)) {
      return next(new AppError('Daily spin limit reached. Come back tomorrow!', 400));
    }

    // Weighted random selection
    const slices = config.slices || [];
    const total = slices.reduce((s, sl) => s + sl.probability, 0);
    let rand = Math.random() * total;
    let result = slices[slices.length - 1];
    for (const slice of slices) {
      rand -= slice.probability;
      if (rand <= 0) { result = slice; break; }
    }

    let pointsAwarded = 0;
    if (result.type === 'points' && result.value > 0) {
      const loyalty = await Loyalty.findOneAndUpdate(
        { user: req.user._id },
        { $inc: { balance: result.value, totalEarned: result.value } },
        { upsert: true, new: true }
      );
      loyalty.transactions.push({ type: 'earn', points: result.value, description: 'Spin & Win reward' });
      if (loyalty.transactions.length > 200) loyalty.transactions.shift();
      await loyalty.save();
      pointsAwarded = result.value;
    }

    const history = await SpinHistory.create({
      user: req.user._id,
      result: { label: result.label, type: result.type, value: result.value },
      pointsAwarded,
    });

    res.json({ result: history.result, pointsAwarded });
  } catch (err) { next(err); }
});

router.get('/spin/history', authenticate, async (req, res, next) => {
  try {
    const history = await SpinHistory.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ history });
  } catch (err) { next(err); }
});

// ─── Quiz ─────────────────────────────────────────────────────────────────────

router.get('/quiz/question', authenticate, async (req, res, next) => {
  try {
    // Get a question the user hasn't attempted today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attempted = await QuizAttempt.find({ user: req.user._id, createdAt: { $gte: today } }).distinct('question');

    const question = await QuizQuestion.findOne({ isActive: true, _id: { $nin: attempted } });
    if (!question) return res.json({ question: null, message: 'No more questions for today' });

    // Return without revealing which option is correct
    res.json({
      question: {
        _id: question._id,
        question: question.question,
        options: question.options.map((o, i) => ({ index: i, text: o.text })),
        pointsOnCorrect: question.pointsOnCorrect,
        difficulty: question.difficulty,
      },
    });
  } catch (err) { next(err); }
});

router.post('/quiz/answer', authenticate, async (req, res, next) => {
  try {
    const { questionId, selectedOption } = req.body;
    if (questionId === undefined || selectedOption === undefined) {
      return next(new AppError('questionId and selectedOption are required', 400));
    }

    const question = await QuizQuestion.findById(questionId);
    if (!question) return next(new AppError('Question not found', 404));

    // Prevent re-answering same question today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await QuizAttempt.findOne({ user: req.user._id, question: questionId, createdAt: { $gte: today } });
    if (existing) return next(new AppError('Already answered this question today', 400));

    const isCorrect = question.options[selectedOption]?.isCorrect === true;
    const pointsEarned = isCorrect ? question.pointsOnCorrect : 0;

    await QuizAttempt.create({ user: req.user._id, question: questionId, selectedOption, isCorrect, pointsEarned });

    if (isCorrect && pointsEarned > 0) {
      const loyalty = await Loyalty.findOneAndUpdate(
        { user: req.user._id },
        { $inc: { balance: pointsEarned, totalEarned: pointsEarned } },
        { upsert: true, new: true }
      );
      loyalty.transactions.push({ type: 'earn', points: pointsEarned, description: 'Quiz correct answer' });
      if (loyalty.transactions.length > 200) loyalty.transactions.shift();
      await loyalty.save();
    }

    res.json({
      isCorrect,
      pointsEarned,
      correctOption: question.options.findIndex((o) => o.isCorrect),
    });
  } catch (err) { next(err); }
});

module.exports = router;
