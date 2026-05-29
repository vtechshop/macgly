const router = require('express').Router();
const Setting = require('../../models/Setting');

// ─── Default Settings Seed ────────────────────────────────────────────────────

const DEFAULTS = [
  // General
  { key: 'site.name',              value: 'Shop',                    type: 'string',  category: 'general',       description: 'Storefront name',                       isPublic: true  },
  { key: 'site.tagline',           value: 'Tools & Machinery',       type: 'string',  category: 'general',       description: 'Site tagline shown in header/footer',    isPublic: true  },
  { key: 'site.currency',          value: 'INR',                     type: 'string',  category: 'general',       description: 'Default currency code',                  isPublic: true  },
  { key: 'site.language',          value: 'en',                      type: 'string',  category: 'general',       description: 'Default language code',                  isPublic: true  },
  { key: 'site.timezone',          value: 'Asia/Kolkata',            type: 'string',  category: 'general',       description: 'Server and display timezone',             isPublic: false },
  { key: 'site.logo',              value: '',                        type: 'string',  category: 'general',       description: 'Logo image URL',                         isPublic: true  },
  { key: 'site.favicon',           value: '',                        type: 'string',  category: 'general',       description: 'Favicon URL',                            isPublic: true  },
  { key: 'free_shipping_banner',   value: '',                        type: 'string',  category: 'general',       description: 'Free shipping banner text',               isPublic: true  },
  // Website
  { key: 'website.products_per_page',       value: '24',            type: 'number',  category: 'website',       description: 'Products shown per page',                isPublic: true  },
  { key: 'website.header_announcement',     value: '',              type: 'string',  category: 'website',       description: 'Announcement bar text',                  isPublic: true  },
  { key: 'website.footer_about',            value: '',              type: 'string',  category: 'website',       description: 'About text in footer',                   isPublic: true  },
  { key: 'website.homepage_layout',         value: 'default',      type: 'string',  category: 'website',       description: 'Homepage layout template',               isPublic: false },
  { key: 'website.breadcrumbs_enabled',     value: 'true',         type: 'boolean', category: 'website',       description: 'Show breadcrumbs on product pages',      isPublic: false },
  { key: 'website.recently_viewed_enabled', value: 'true',         type: 'boolean', category: 'website',       description: 'Show recently viewed products',          isPublic: false },
  { key: 'website.lazy_load_images',        value: 'true',         type: 'boolean', category: 'website',       description: 'Lazy-load images for performance',       isPublic: false },
  // Ads
  { key: 'ads.enabled',            value: 'true',                    type: 'boolean', category: 'ads',           description: 'Enable sponsored ads system',             isPublic: false },
  { key: 'ads.min_bid',            value: '1',                       type: 'number',  category: 'ads',           description: 'Minimum bid amount (₹)',                  isPublic: false },
  { key: 'ads.max_budget',         value: '50000',                   type: 'number',  category: 'ads',           description: 'Maximum daily ad budget (₹)',             isPublic: false },
  { key: 'ads.auto_approve',       value: 'false',                   type: 'boolean', category: 'ads',           description: 'Auto-approve new ad campaigns',           isPublic: false },
  { key: 'ads.placements_config',  value: '{}',                      type: 'json',    category: 'ads',           description: 'Ad placement configuration (JSON)',       isPublic: false },
  // Email
  { key: 'email.smtp_host',        value: '',                        type: 'string',  category: 'email',         description: 'SMTP server hostname',                   isPublic: false },
  { key: 'email.smtp_port',        value: '587',                     type: 'number',  category: 'email',         description: 'SMTP port',                              isPublic: false },
  { key: 'email.smtp_user',        value: '',                        type: 'string',  category: 'email',         description: 'SMTP username / email',                  isPublic: false },
  { key: 'email.smtp_password',    value: '',                        type: 'string',  category: 'email',         description: 'SMTP password',                          isPublic: false },
  { key: 'email.from_address',     value: 'noreply@vtechkitchen.com', type: 'string', category: 'email',         description: 'From email address for outgoing mail',    isPublic: false },
  { key: 'email.from_name',        value: 'VTech Kitchen',           type: 'string',  category: 'email',         description: 'From display name',                      isPublic: false },
  // Payment
  { key: 'payment.razorpay_key_id',     value: '',         type: 'string',  category: 'payment',       description: 'Razorpay publishable Key ID',            isPublic: true  },
  { key: 'payment.razorpay_key_secret', value: '',         type: 'string',  category: 'payment',       description: 'Razorpay secret key',                    isPublic: false },
  { key: 'payment.razorpay_enabled',    value: 'true',     type: 'boolean', category: 'payment',       description: 'Enable Razorpay payments',                isPublic: true  },
  { key: 'payment.cod_enabled',         value: 'true',     type: 'boolean', category: 'payment',       description: 'Enable Cash on Delivery',                 isPublic: true  },
  { key: 'payment.cod_max_amount',      value: '10000',    type: 'number',  category: 'payment',       description: 'Maximum COD order value (₹)',             isPublic: true  },
  { key: 'payment.platform_commission', value: '10',       type: 'number',  category: 'payment',       description: 'Default platform commission % on sales',  isPublic: false },
  { key: 'payment.auto_payout',         value: 'false',    type: 'boolean', category: 'payment',       description: 'Auto-payout vendor earnings weekly',      isPublic: false },
  // Shipping
  { key: 'shipping.free_threshold',     value: '5000',     type: 'number',  category: 'shipping',      description: 'Order amount for free shipping (₹)',      isPublic: true  },
  { key: 'shipping.default_rate',       value: '70',       type: 'number',  category: 'shipping',      description: 'Standard shipping charge (₹)',            isPublic: true  },
  { key: 'shipping.express_rate',       value: '120',      type: 'number',  category: 'shipping',      description: 'Express shipping charge (₹)',             isPublic: true  },
  { key: 'shipping.provider',           value: 'shiprocket', type: 'string', category: 'shipping',     description: 'Default shipping provider',               isPublic: false },
  { key: 'shipping.shiprocket_enabled', value: 'true',     type: 'boolean', category: 'shipping',      description: 'Enable Shiprocket integration',           isPublic: false },
  { key: 'shipping.cod_areas_fallback', value: 'all',      type: 'string',  category: 'shipping',      description: 'COD availability (all / pincode_list)',    isPublic: false },
  // Security
  { key: 'security.max_login_attempts', value: '5',        type: 'number',  category: 'security',      description: 'Failed logins before lockout',            isPublic: false },
  { key: 'security.session_timeout',    value: '86400',    type: 'number',  category: 'security',      description: 'Session timeout in seconds',              isPublic: false },
  { key: 'security.two_factor_enabled', value: 'false',    type: 'boolean', category: 'security',      description: 'Require 2FA for admin login',             isPublic: false },
  { key: 'security.password_min_length', value: '8',       type: 'number',  category: 'security',      description: 'Minimum password length',                 isPublic: false },
  { key: 'security.rate_limit_enabled',  value: 'true',    type: 'boolean', category: 'security',      description: 'Enable API rate limiting',                isPublic: false },
  { key: 'security.ip_whitelist',        value: '',        type: 'string',  category: 'security',      description: 'Comma-separated admin IP whitelist',      isPublic: false },
  // Notifications
  { key: 'notifications.order_email_enabled', value: 'true', type: 'boolean', category: 'notifications', description: 'Send order confirmation emails',         isPublic: false },
  { key: 'notifications.admin_email',          value: '',    type: 'string',  category: 'notifications', description: 'Admin alert email address',              isPublic: false },
  { key: 'notifications.low_stock_threshold',  value: '10',  type: 'number',  category: 'notifications', description: 'Stock level to trigger low-stock alert', isPublic: false },
  { key: 'notifications.sms_enabled',          value: 'false', type: 'boolean', category: 'notifications', description: 'Enable SMS notifications',             isPublic: false },
  { key: 'notifications.push_enabled',         value: 'false', type: 'boolean', category: 'notifications', description: 'Enable push notifications',            isPublic: false },
  // Features
  { key: 'features.reviews_enabled',    value: 'true',  type: 'boolean', category: 'features', description: 'Enable product reviews',              isPublic: true  },
  { key: 'features.affiliate_enabled',  value: 'true',  type: 'boolean', category: 'features', description: 'Enable affiliate program',             isPublic: true  },
  { key: 'features.warranty_enabled',   value: 'true',  type: 'boolean', category: 'features', description: 'Enable warranty management',           isPublic: true  },
  { key: 'features.flash_sales_enabled', value: 'true', type: 'boolean', category: 'features', description: 'Enable flash sales',                   isPublic: true  },
  { key: 'features.wishlist_enabled',   value: 'true',  type: 'boolean', category: 'features', description: 'Enable customer wishlist',             isPublic: true  },
  { key: 'features.chat_enabled',       value: 'false', type: 'boolean', category: 'features', description: 'Enable live chat widget',              isPublic: true  },
  { key: 'features.coupons_enabled',    value: 'true',  type: 'boolean', category: 'features', description: 'Enable coupon codes',                  isPublic: false },
  { key: 'features.referral_enabled',   value: 'true',  type: 'boolean', category: 'features', description: 'Enable referral program',              isPublic: true  },
  { key: 'features.blog_enabled',       value: 'true',  type: 'boolean', category: 'features', description: 'Show blog section',                   isPublic: false },
  { key: 'features.newsletter_enabled', value: 'true',  type: 'boolean', category: 'features', description: 'Enable newsletter signup',             isPublic: false },
  // Integrations
  { key: 'integrations.google_analytics_id',    value: '', type: 'string',  category: 'integrations', description: 'Google Analytics Measurement ID',   isPublic: true  },
  { key: 'integrations.facebook_pixel_id',      value: '', type: 'string',  category: 'integrations', description: 'Facebook Pixel ID',                  isPublic: true  },
  { key: 'integrations.shiprocket_email',        value: '', type: 'string',  category: 'integrations', description: 'Shiprocket account email',           isPublic: false },
  { key: 'integrations.shiprocket_password',     value: '', type: 'string',  category: 'integrations', description: 'Shiprocket account password',        isPublic: false },
  { key: 'integrations.whatsapp_number',         value: '', type: 'string',  category: 'integrations', description: 'WhatsApp support number (intl)',      isPublic: true  },
  { key: 'integrations.google_maps_api_key',     value: '', type: 'string',  category: 'integrations', description: 'Google Maps API key',                isPublic: false },
  { key: 'integrations.instagram_feed_enabled',  value: 'false', type: 'boolean', category: 'integrations', description: 'Show Instagram feed on homepage', isPublic: false },
  // Maintenance
  { key: 'maintenance.enabled',       value: 'false',                                     type: 'boolean', category: 'maintenance', description: 'Enable maintenance mode',                    isPublic: true  },
  { key: 'maintenance.message',       value: 'We are down for maintenance. Back shortly!', type: 'string',  category: 'maintenance', description: 'Message shown on maintenance page',           isPublic: true  },
  { key: 'maintenance.allowed_ips',   value: '',                                           type: 'string',  category: 'maintenance', description: 'Comma-separated IPs bypassing maintenance',   isPublic: false },
  { key: 'maintenance.bypass_token',  value: '',                                           type: 'string',  category: 'maintenance', description: 'Secret token to bypass maintenance mode',     isPublic: false },
];

let seeded = false;
async function seedDefaults() {
  if (seeded) return;
  seeded = true;
  try {
    const existing = await Setting.find({}, { key: 1 });
    const existingKeys = new Set(existing.map((s) => s.key));
    const missing = DEFAULTS.filter((d) => !existingKeys.has(d.key));
    if (missing.length) await Setting.insertMany(missing, { ordered: false }).catch(() => {});
  } catch (_) {}
}

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res, next) => {
  try {
    await seedDefaults();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, publicCount, categoryCounts, recentlyUpdated, featuresEnabled] = await Promise.all([
      Setting.countDocuments(),
      Setting.countDocuments({ isPublic: true }),
      Setting.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Setting.countDocuments({ updatedAt: { $gte: today } }),
      Setting.countDocuments({
        $or: [
          { type: 'boolean', value: 'true' },
          { type: 'boolean', value: true },
          { key: /enabled$/i, value: 'true' },
          { key: /enabled$/i, value: true },
        ],
      }),
    ]);

    const byCategory = {};
    categoryCounts.forEach((c) => { if (c._id) byCategory[c._id] = c.count; });

    res.json({
      total,
      categories: categoryCounts.filter((c) => c._id).length,
      public: publicCount,
      private: total - publicCount,
      recentlyUpdated,
      featuresEnabled,
      byCategory,
    });
  } catch (err) { next(err); }
});

// ─── Export ───────────────────────────────────────────────────────────────────

router.get('/export', async (req, res, next) => {
  try {
    const settings = await Setting.find()
      .sort({ category: 1, key: 1 })
      .select('key value type category description isPublic -_id');
    res.json(settings);
  } catch (err) { next(err); }
});

// ─── Bulk Update / Import ─────────────────────────────────────────────────────

router.post('/bulk-update', async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings) || !settings.length) {
      return res.status(400).json({ error: { message: 'settings array required' } });
    }

    let updatedCount = 0;
    let errorsCount = 0;
    const errors = [];

    for (const s of settings) {
      try {
        if (!s.key) { errorsCount++; continue; }
        await Setting.findOneAndUpdate(
          { key: s.key },
          {
            $set: {
              value: s.value,
              type: s.type || 'string',
              category: s.category || 'general',
              ...(s.description !== undefined ? { description: s.description } : {}),
              ...(s.isPublic !== undefined ? { isPublic: s.isPublic } : {}),
            },
          },
          { upsert: true, new: true },
        );
        updatedCount++;
      } catch (err) {
        errorsCount++;
        if (errors.length < 10) errors.push({ key: s.key, error: err.message });
      }
    }

    res.json({ updatedCount, errorsCount, ...(errors.length ? { errors } : {}) });
  } catch (err) { next(err); }
});

// ─── List by Category ─────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    await seedDefaults();
    const { category = 'general' } = req.query;
    const settings = await Setting.find({ category }).sort({ key: 1 });
    res.json(settings);
  } catch (err) { next(err); }
});

// ─── Update Single Setting ────────────────────────────────────────────────────

router.put('/:key(*)', async (req, res, next) => {
  try {
    const key = req.params.key;
    const { value, type, category, description } = req.body;

    const setting = await Setting.findOneAndUpdate(
      { key },
      { $set: { value, ...(type ? { type } : {}), ...(category ? { category } : {}) } },
      { upsert: true, new: true },
    );

    if (description !== undefined) {
      setting.description = description;
      await setting.save();
    }

    res.json({ setting });
  } catch (err) { next(err); }
});

module.exports = router;
