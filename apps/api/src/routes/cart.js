const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');
const { getCart, addItem, updateItem, removeItem, clearCart } = require('../controllers/cartController');

router.use(optionalAuth);

router.get('/', getCart);
router.post('/items', addItem);
router.put('/items/:itemId', updateItem);
router.delete('/items/:itemId', removeItem);
router.delete('/', clearCart);

module.exports = router;
