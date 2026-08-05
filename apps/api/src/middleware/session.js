const crypto = require('crypto');
const { isProd } = require('../config/env');

const SESSION_COOKIE = 'sessionId';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// 32 lowercase hex chars = 128 bits of entropy from crypto.randomBytes(16).
// Anything that does not match is treated as absent, which also permanently
// retires the old shared literal 'anon' value.
const SESSION_ID_RE = /^[0-9a-f]{32}$/;

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd(),
  // 'lax' (not 'strict') on purpose: the cart must survive a top-level navigation
  // back into the site from WhatsApp, email or search results. This cookie is not
  // an auth credential — access tokens keep their stricter settings.
  sameSite: 'lax',
  path: '/',
};

/**
 * Guarantees every visitor has their own cart session.
 *
 * Mounted on the cart routes only, which is the sole place a guest cart is
 * created or read. Sets req.sessionId for downstream handlers in the same
 * request, so the very first cart call already has a usable session.
 */
function ensureSession(req, res, next) {
  if (!req.cookies) req.cookies = {};

  const existing = req.cookies[SESSION_COOKIE];
  if (SESSION_ID_RE.test(existing || '')) {
    req.sessionId = existing;
    req.sessionIsNew = false;
    return next();
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  res.cookie(SESSION_COOKIE, sessionId, { ...SESSION_COOKIE_OPTS, maxAge: SESSION_MAX_AGE_MS });
  req.cookies[SESSION_COOKIE] = sessionId;
  req.sessionId = sessionId;
  req.sessionIsNew = true;
  next();
}

/** Reads the session id without issuing one. Safe on routes without ensureSession. */
function getSessionId(req) {
  const raw = req.sessionId || req.cookies?.[SESSION_COOKIE];
  return SESSION_ID_RE.test(raw || '') ? raw : null;
}

/** Drops the session cookie so a shared browser never inherits the previous person's guest cart. */
function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTS);
}

module.exports = { ensureSession, getSessionId, clearSession, SESSION_COOKIE };
