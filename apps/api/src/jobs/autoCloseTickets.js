const Ticket = require('../models/Ticket');

const INACTIVITY_HOURS = parseInt(process.env.TICKET_AUTO_CLOSE_HOURS) || 24;

async function run() {
  const cutoff = new Date(Date.now() - INACTIVITY_HOURS * 60 * 60 * 1000);

  // Close tickets where admin replied last but user hasn't responded in 24h
  const result = await Ticket.updateMany(
    {
      status: { $in: ['open', 'in_progress'] },
      lastResponseBy: 'support',
      updatedAt: { $lte: cutoff },
    },
    { $set: { status: 'closed' } },
  );

  if (result.modifiedCount > 0) {
    console.log(`[AutoCloseTickets] Closed ${result.modifiedCount} inactive ticket(s) (no user response in ${INACTIVITY_HOURS}h)`);
  }
  return result.modifiedCount;
}

module.exports = { run };
