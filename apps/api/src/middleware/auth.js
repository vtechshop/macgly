const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET } = require('../config/env');
const AppError = require('../utils/AppError');
const User = require('../models/User');

async function authenticate(req, res, next) {
  try {
    const token = req.cookies.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');

    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user || !user.isActive) throw new AppError('User not found or inactive', 401, 'AUTH_REQUIRED');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    if (!roles.includes(req.user.role)) return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    next();
  };
}

async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    if (!token) return next();
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (user?.isActive) req.user = user;
  } catch {
    // ignore — optional
  }
  next();
}

module.exports = { authenticate, authorize, optionalAuth };
