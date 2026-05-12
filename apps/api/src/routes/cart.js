const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');
const { getCart, addItem, updateItem, removeItem, applyCoupon, clearCart } = require('../controllers/cartController');

router.use(optionalAuth);

router.get('/', getCart);
router.post('/items', addItem);
router.put('/items/:itemId', updateItem);
router.delete('/items/:itemId', removeItem);
router.post('/coupon', applyCoupon);
router.delete('/', clearCart);

module.exports = router;
