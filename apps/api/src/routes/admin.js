const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize(['admin']));

// Products
router.use('/products', require('./admin/products'));
// Categories
router.use('/categories', require('./admin/categories'));
// Banners
router.use('/banners', require('./admin/banners'));
// Users
router.use('/users', require('./admin/users'));
// Orders
router.use('/orders', require('./admin/orders'));
// Stats
router.use('/stats', require('./admin/stats'));
// Coupons
router.use('/coupons', require('./admin/coupons'));
// Upload
router.use('/upload', require('./admin/upload'));
// Support tickets
router.use('/tickets', require('./admin/tickets'));
// Payments
router.use('/payments', require('./admin/payments'));
// KYC
router.use('/kyc', require('./admin/kyc'));
// Reviews
router.use('/reviews', require('./admin/reviews'));
// Warranty
router.use('/warranty', require('./admin/warranty'));

module.exports = router;
