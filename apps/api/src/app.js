const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { FRONTEND_URL, NODE_ENV, CSRF_SECRET, isProd } = require('./config/env');
const AppError = require('./utils/AppError');
const { apiLimiter } = require('./middleware/rateLimiter');
const { ensureSession } = require('./middleware/session');

const app = express();

// Trust Render/proxy headers for rate limiting and IP detection
app.set('trust proxy', 1);

// Gzip compression — must be before routes
app.use(compression());

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://res.cloudinary.com',
        'https://images.unsplash.com',
        'https://*.googleusercontent.com',
        'https://*.amazonaws.com',
      ],
      connectSrc: [
        "'self'",
        'https://api.razorpay.com',
        'https://checkout.razorpay.com',
        'https://macgly-api.onrender.com',
        'https://api.macgly.com',
      ],
      frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
    },
  },
}));

// CORS — exact allowlist only, no prefix/suffix matching
const allowedOrigins = new Set([
  FRONTEND_URL,
  'https://macgly.vercel.app',
  'https://macgly.com',
  'https://www.macgly.com',
].filter(Boolean));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));

// Body parsing — capture raw body for webhook HMAC verification
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    if (req.path.startsWith('/api/payments/webhook')) req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Sanitize MongoDB operators from req.body/params/query
app.use(mongoSanitize());

// Logging
if (NODE_ENV !== 'test') app.use(morgan(isProd() ? 'combined' : 'dev'));

// Rate limiting
app.use('/api', apiLimiter);

// CSRF — skip for GET/HEAD/OPTIONS and for non-browser API calls
if (isProd()) {
  const csrf = require('csurf');
  const csrfProtection = csrf({
    cookie: { httpOnly: true, sameSite: 'strict', secure: true },
  });
  app.use((req, res, next) => {
    const skip = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      req.path.startsWith('/api/auth/refresh') ||
      req.path.startsWith('/api/payments/webhook');
    if (skip) return next();
    csrfProtection(req, res, next);
  });

  app.get('/api/csrf-token', csrf({ cookie: true }), (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });
} else {
  // In dev, expose a no-op endpoint so frontend code works unchanged
  app.get('/api/csrf-token', (req, res) => res.json({ csrfToken: 'dev-csrf-token' }));
}

// Static uploads in dev
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Bot/crawler detection for SSR
app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const bots = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot/i;
  req.isBot = bots.test(ua);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/orders', require('./routes/orders'));
// ensureSession issues a per-browser cart session cookie. Mounted only here —
// the cart routes are the sole place a guest cart is created or read.
app.use('/api/cart', ensureSession, require('./routes/cart'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/affiliates', require('./routes/affiliates'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/warranties', require('./routes/warranties'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/gdpr', require('./routes/gdpr'));
app.use('/api/config', require('./routes/config'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/referrals', require('./routes/referrals'));
// app.use, NOT app.get. app.get(path, Router) does not rewrite req.url, so the
// router still saw '/sitemap.xml', its own router.get('/') never matched, it
// called next(), and the SPA catch-all answered with index.html at HTTP 200 —
// Google was being served an HTML page for the sitemap it is told to fetch.
app.use('/sitemap.xml', require('./routes/sitemap'));
// robots.txt has exactly one source of truth: apps/web/public/robots.txt, which
// Vite copies into the build output and express.static below serves. This route
// only handles the case the static file cannot: a non-canonical hostname.
//
// render.yaml builds apps/web and this process serves apps/web/dist, so the API
// origin (macgly.onrender.com) answers with the whole storefront. Left
// crawlable, that is the entire catalogue duplicated under a second hostname.
app.get('/robots.txt', (req, res, next) => {
  let canonicalHost = '';
  try { canonicalHost = new URL(FRONTEND_URL).hostname; } catch { /* unset in dev */ }
  if (canonicalHost && req.hostname !== canonicalHost) {
    res.type('text/plain');
    return res.send(`# ${req.hostname} is not the canonical host (${canonicalHost}).\nUser-agent: *\nDisallow: /\n`);
  }
  return next();
});

// Serve React app in production (Vite handles it in dev)
if (isProd()) {
  // __dirname = apps/api/src — go up 3 levels to repo root, then into web/dist
  const DIST = path.join(__dirname, '../../../apps/web/dist');
  app.use(express.static(DIST, {
    index: false,
    // Without this, prerendered dist/product/<slug>/index.html makes
    // serve-static 301 /product/<slug> to /product/<slug>/ — two URLs for one
    // page, and not the one in the sitemap. The catch-all below resolves the
    // directory itself, which is also how Vercel serves these files.
    redirect: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    // Prefer a prerendered shell if the build produced one for this route
    // (apps/web/scripts/prerender.mjs). express.static above runs with
    // index:false, so it will not serve dist/<route>/index.html itself. Vercel
    // serves those files statically on the public domain; this keeps the Render
    // origin identical rather than quietly serving different metadata.
    const candidate = path.resolve(DIST, `.${req.path}`, 'index.html');
    if (candidate.startsWith(DIST + path.sep) && fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

// 404 for unmatched API routes (and all routes in dev)
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
});

// Global error handler
app.use((err, req, res, next) => {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const fields = {};
    Object.values(err.errors).forEach((e) => { fields[e.path] = e.message; });
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', fields } });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: { code: 'DUPLICATE_KEY', message: `${field} already exists` } });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Token expired' } });
  }

  // CSRF error
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: { code: 'INVALID_CSRF', message: 'Invalid CSRF token' } });
  }

  // Operational AppError
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }

  // Unhandled / programming error
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
});

module.exports = app;
