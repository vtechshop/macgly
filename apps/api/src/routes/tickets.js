const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { createTicket, getTickets, getTicket, replyToTicket } = require('../controllers/ticketController');

router.use(authenticate);

router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicket);
router.post('/:id/reply', replyToTicket);

module.exports = router;
