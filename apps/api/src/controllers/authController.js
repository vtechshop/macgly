const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const {
  JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES, JWT_REFRESH_EXPIRES,
  FRONTEND_URL, isProd,
} = require('../config/env');
const { sendPasswordReset } = require('../services/emailService');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd(),
  sameSite: isProd() ? 'strict' : 'lax',
};

function signAccess(id, role) {
  return jwt.sign({ id, role }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });
}

function signRefresh(id) {
  return jwt.sign({ id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
}

function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone, referralCode, role, vendorProfile } = req.body;
    if (!name || !email || !password) throw new AppError('name, email, and password are required', 400, 'MISSING_FIELDS');

    // Only 'vendor' or 'affiliate' can be self-selected; everything else defaults to 'customer'
    const userRole = role === 'vendor' ? 'vendor' : role === 'affiliate' ? 'affiliate' : 'customer';

    let referredBy;
    if (referralCode) {
      const affiliate = await User.findOne({
        'affiliateProfile.referralCode': referralCode.toUpperCase().trim(),
        role: 'affiliate',
      });
      if (affiliate) referredBy = affiliate._id;
    }

    const userData = { name, email, password, phone, referredBy, role: userRole };
    if (userRole === 'vendor' && vendorProfile) {
      userData.vendorProfile = { businessName: vendorProfile.businessName, gstin: vendorProfile.gstin };
    }
    if (userRole === 'affiliate') {
      userData.affiliateProfile = { commissionRate: 5 };
    }

    const user = await User.create(userData);
    const accessToken = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);

    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: refreshToken } });
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({ user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError('email and password are required', 400, 'MISSING_FIELDS');

    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) throw new AppError('Account is deactivated', 403, 'ACCOUNT_INACTIVE');

    const accessToken = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);

    // Keep last 5 refresh tokens (multi-device)
    const tokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    user.refreshTokens = tokens;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    setTokenCookies(res, accessToken, refreshToken);
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  const clearAndReject = (res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Session expired, please login again' } });
  };

  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Refresh token required' } });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch {
      return clearAndReject(res);
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.refreshTokens?.includes(token)) {
      return clearAndReject(res);
    }

    const newAccess = signAccess(user._id, user.role);
    const newRefresh = signRefresh(user._id);

    user.refreshTokens = [...user.refreshTokens.filter((t) => t !== token), newRefresh];
    await user.save({ validateBeforeSave: false });

    setTokenCookies(res, newAccess, newRefresh);
    res.json({ ok: true });
  } catch (err) {
    return clearAndReject(res);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded?.id) {
        await User.findByIdAndUpdate(decoded.id, { $pull: { refreshTokens: token } });
      }
    }
    res.clearCookie('accessToken', COOKIE_OPTS);
    res.clearCookie('refreshToken', COOKIE_OPTS);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email is required', 400, 'MISSING_FIELDS');

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always respond success so we don't reveal if the email exists
    if (!user) return res.json({ ok: true });

    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${FRONTEND_URL}/reset-password/${plainToken}`;
    await sendPasswordReset({ email: user.email, name: user.name, resetUrl });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new AppError('Token and password are required', 400, 'MISSING_FIELDS');
    if (password.length < 6) throw new AppError('Password must be at least 6 characters', 400, 'WEAK_PASSWORD');

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) throw new AppError('Reset link is invalid or has expired', 400, 'INVALID_TOKEN');

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, me, forgotPassword, resetPassword };
