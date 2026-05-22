require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });

const isProd = () => process.env.NODE_ENV === 'production';

// Crash fast in production if critical secrets are missing
if (isProd()) {
  const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('FATAL: Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  if (process.env.JWT_ACCESS_SECRET === 'dev_access_secret' || process.env.JWT_REFRESH_SECRET === 'dev_refresh_secret') {
    console.error('FATAL: Dev JWT secrets used in production');
    process.exit(1);
  }
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/shop',
  REDIS_URL: process.env.REDIS_URL || null,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',

  CSRF_SECRET: process.env.CSRF_SECRET || 'dev_csrf_secret',

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  MAILERSEND_API_KEY: process.env.MAILERSEND_API_KEY || '',
  MAILERSEND_FROM_EMAIL: process.env.MAILERSEND_FROM_EMAIL || 'no-reply@localhost',
  MAILERSEND_FROM_NAME: process.env.MAILERSEND_FROM_NAME || 'Shop',

  DELHIVERY_API_KEY: process.env.DELHIVERY_API_KEY || '',
  DELHIVERY_BASE_URL: process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com',

  SHIPROCKET_EMAIL: process.env.SHIPROCKET_EMAIL || '',
  SHIPROCKET_PASSWORD: process.env.SHIPROCKET_PASSWORD || '',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  isProd,
};
