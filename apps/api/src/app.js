const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const path = require('path');

const { FRONTEND_URL, NODE_ENV, CSRF_SECRET, isProd } = require('./config/env');
const AppError = require('./utils/AppError');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

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

// CORS
const allowedOrigins = [
  FRONTEND_URL,
  'https://macgly.vercel.app',
  'https://macgly.com',
  'https://www.macgly.com',
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    // Allow any Vercel preview deploy and all production domains
    if (origin.endsWith('.vercel.app') || allowedOrigins.some(o => origin.startsWith(o))) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Sanitize MongoDB operators from req.body/params/query
app.use(mongoSanitize());

// Logging
if (NODE_ENV !== 'test') app.use(morgan('dev'));

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
app.use('/api/cart', require('./routes/cart'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/affiliates', require('./routes/affiliates'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/warranties', require('./routes/warranties'));
app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/flash-sales', require('./routes/flash-sales'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/gdpr', require('./routes/gdpr'));
app.use('/api/config', require('./routes/config'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/referrals', require('./routes/referrals'));
app.get('/sitemap.xml', require('./routes/sitemap'));
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /api/\nSitemap: https://macgly.com/sitemap.xml`);
});

// Serve React app in production (Vite handles it in dev)
if (isProd()) {
  // __dirname = apps/api/src — go up 3 levels to repo root, then into web/dist
  const DIST = path.join(__dirname, '../../../apps/web/dist');
  app.use(express.static(DIST, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
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
