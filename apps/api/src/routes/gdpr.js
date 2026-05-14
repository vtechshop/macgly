const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { exportUserData, deleteAccount } = require('../services/gdprService');
const AppError = require('../utils/AppError');

router.use(authenticate);

router.get('/export', async (req, res, next) => {
  try {
    const data = await exportUserData(req.user._id);
    res.setHeader('Content-Disposition', `attachment; filename="macgly-data-${req.user._id}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (err) { next(err); }
});

router.delete('/account', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) throw new AppError('Password required to confirm deletion', 400, 'MISSING_FIELDS');
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('+password');
    const valid = await user.comparePassword(password);
    if (!valid) throw new AppError('Incorrect password', 401, 'INVALID_PASSWORD');
    await deleteAccount(req.user._id);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Account deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
