const Ticket = require('../models/Ticket');
const AppError = require('../utils/AppError');
const notif = require('../utils/notificationHelper');

async function createTicket(req, res, next) {
  try {
    const { subject, category, priority, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      throw new AppError('Subject and message are required', 400, 'MISSING_FIELDS');
    }
    const ticket = await Ticket.create({
      user: req.user._id,
      subject: subject.trim(),
      category: category || 'other',
      priority: priority || 'medium',
      messages: [{ senderRole: 'user', content: message.trim() }],
    });

    // Notify admins of new ticket
    notif.notifyAdminNewTicket({
      ticket,
      userEmail: req.user.email,
    }).catch(() => {});

    res.status(201).json({ ticket });
  } catch (err) { next(err); }
}

async function getTickets(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { user: req.user._id };
    const [tickets, total] = await Promise.all([
      Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select('-messages'),
      Ticket.countDocuments(filter),
    ]);
    res.json({ tickets, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
}

async function getTicket(req, res, next) {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, user: req.user._id });
    if (!ticket) throw new AppError('Ticket not found', 404, 'NOT_FOUND');
    res.json({ ticket });
  } catch (err) { next(err); }
}

async function replyToTicket(req, res, next) {
  try {
    const { message } = req.body;
    if (!message?.trim()) throw new AppError('Message is required', 400, 'MISSING_FIELDS');
    const ticket = await Ticket.findOne({ _id: req.params.id, user: req.user._id });
    if (!ticket) throw new AppError('Ticket not found', 404, 'NOT_FOUND');
    if (ticket.status === 'closed') throw new AppError('Cannot reply to a closed ticket', 400, 'TICKET_CLOSED');
    ticket.messages.push({ senderRole: 'user', content: message.trim() });
    if (ticket.status === 'resolved') ticket.status = 'open';
    await ticket.save();
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Admin handlers
async function adminGetTickets(req, res, next) {
  try {
    const { page = 1, limit = 30, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = status ? { status } : {};
    const [tickets, total] = await Promise.all([
      Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
        .populate('user', 'name email').select('-messages'),
      Ticket.countDocuments(filter),
    ]);
    res.json({ tickets, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
}

async function adminGetTicket(req, res, next) {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('user', 'name email role');
    if (!ticket) throw new AppError('Ticket not found', 404, 'NOT_FOUND');
    res.json({ ticket });
  } catch (err) { next(err); }
}

async function adminReply(req, res, next) {
  try {
    const { message, status } = req.body;
    const ticket = await Ticket.findById(req.params.id).populate('user', '_id email name');
    if (!ticket) throw new AppError('Ticket not found', 404, 'NOT_FOUND');

    const prevStatus = ticket.status;

    if (message?.trim()) {
      ticket.messages.push({ senderRole: 'support', content: message.trim() });
    }
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      ticket.status = status;
    }
    await ticket.save();

    // Notify ticket owner of the reply and/or status change
    if (ticket.user?._id) {
      if (message?.trim()) {
        notif.notifyUserTicketReply({
          userId:     ticket.user._id,
          ticket,
          repliedBy:  req.user?.name || 'Support',
        }).catch(() => {});
      }
      if (status && status !== prevStatus) {
        notif.notifyUserTicketStatusChange({
          userId: ticket.user._id,
          ticket,
          status,
        }).catch(() => {});
      }
    }

    res.json({ ticket });
  } catch (err) { next(err); }
}

module.exports = { createTicket, getTickets, getTicket, replyToTicket, adminGetTickets, adminGetTicket, adminReply };
