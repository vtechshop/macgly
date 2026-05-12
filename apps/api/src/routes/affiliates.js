const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { trackClick, recordClick, getStats, getOrders, generateCode, submitKyc } = require('../controllers/affiliateController');

// Public: legacy redirect-based tracking
router.get('/track', trackClick);
// Public (optionally authenticated): client-side click recording
router.get('/record-click', optionalAuth, recordClick);

router.use(authenticate);
router.use(authorize(['affiliate', 'admin']));

router.get('/stats', getStats);
router.get('/orders', getOrders);
router.post('/generate-code', generateCode);
router.post('/kyc', submitKyc);

module.exports = router;
