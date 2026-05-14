const router = require('express').Router();
const AppConfig = require('../models/AppConfig');

const PUBLIC_KEYS = [
  'site_name', 'site_tagline', 'site_logo', 'site_favicon',
  'contact_phone', 'contact_email', 'contact_address',
  'razorpay_key_id', 'free_shipping_above', 'cod_available',
  'loyalty_enabled', 'referral_enabled', 'flash_sales_enabled',
  'social_facebook', 'social_instagram', 'social_youtube', 'social_twitter',
  'footer_about', 'maintenance_mode',
];

router.get('/', async (req, res, next) => {
  try {
    const configs = await AppConfig.find({ key: { $in: PUBLIC_KEYS } });
    const result = {};
    configs.forEach((c) => { result[c.key] = c.value; });
    res.json({ config: result });
  } catch (err) { next(err); }
});

module.exports = router;
