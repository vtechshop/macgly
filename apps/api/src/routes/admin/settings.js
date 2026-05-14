const router = require('express').Router();
const AppConfig = require('../../models/AppConfig');

const DEFAULTS = [
  { key: 'site_name', value: 'Macgly', description: 'Site display name' },
  { key: 'site_tagline', value: 'Tools & Machinery Marketplace', description: 'Tagline shown in header/footer' },
  { key: 'support_email', value: 'support@macgly.com', description: 'Customer support email' },
  { key: 'support_phone', value: '', description: 'Customer support phone' },
  { key: 'free_shipping_threshold', value: 5000, description: 'Order value above which shipping is free (₹)' },
  { key: 'standard_shipping_charge', value: 70, description: 'Standard shipping charge (₹)' },
  { key: 'express_shipping_charge', value: 120, description: 'Express shipping charge (₹)' },
  { key: 'platform_commission_rate', value: 10, description: 'Default platform commission % on vendor sales' },
  { key: 'affiliate_commission_rate', value: 5, description: 'Default affiliate commission %' },
  { key: 'max_cod_amount', value: 10000, description: 'Max order value allowed for Cash on Delivery (₹)' },
  { key: 'maintenance_mode', value: false, description: 'Put site in maintenance mode' },
  { key: 'whatsapp_number', value: '', description: 'WhatsApp support number (with country code)' },
];

router.get('/', async (req, res, next) => {
  try {
    const configs = await AppConfig.find().sort({ key: 1 });
    // Seed defaults for any missing keys
    const existingKeys = configs.map((c) => c.key);
    const missing = DEFAULTS.filter((d) => !existingKeys.includes(d.key));
    if (missing.length) await AppConfig.insertMany(missing);
    const all = missing.length ? await AppConfig.find().sort({ key: 1 }) : configs;
    res.json({ configs: all });
  } catch (err) { next(err); }
});

router.put('/:key', async (req, res, next) => {
  try {
    const { value } = req.body;
    const config = await AppConfig.findOneAndUpdate(
      { key: req.params.key },
      { value },
      { new: true, upsert: true }
    );
    res.json({ config });
  } catch (err) { next(err); }
});

module.exports = router;
