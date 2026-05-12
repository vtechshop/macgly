const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { createOrder, getOrders, getOrder, cancelOrder } = require('../controllers/orderController');

router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/:id/cancel', cancelOrder);

module.exports = router;
