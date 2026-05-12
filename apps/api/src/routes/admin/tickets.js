const router = require('express').Router();
const { adminGetTickets, adminGetTicket, adminReply } = require('../../controllers/ticketController');

router.get('/', adminGetTickets);
router.get('/:id', adminGetTicket);
router.post('/:id/reply', adminReply);

module.exports = router;
