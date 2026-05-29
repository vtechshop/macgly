const router = require('express').Router();
const {
  adminGetStats, adminGetTickets, adminGetTicket,
  adminUpdateStatus, adminUpdatePriority, adminReply,
} = require('../../controllers/ticketController');

router.get('/stats',          adminGetStats);
router.get('/',               adminGetTickets);
router.get('/:id',            adminGetTicket);
router.put('/:id/status',     adminUpdateStatus);
router.put('/:id/priority',   adminUpdatePriority);
router.post('/:id/reply',     adminReply);

module.exports = router;
