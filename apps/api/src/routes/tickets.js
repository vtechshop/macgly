const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  createTicket, getTickets, getTicket, replyToTicket, getMyStats,
} = require('../controllers/ticketController');

router.use(authenticate);

router.get('/my-stats', getMyStats);          // must be before /:id
router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicket);
router.post('/:id/reply', replyToTicket);
router.post('/:id/messages', replyToTicket);  // alias per spec

module.exports = router;
