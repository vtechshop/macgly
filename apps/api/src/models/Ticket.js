const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderRole:  { type: String, enum: ['user', 'support'], required: true },
  content:     { type: String, required: true, maxlength: 5000 },
  attachments: [String],
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
  ticketId:   { type: String, unique: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject:    { type: String, required: true, maxlength: 200 },
  category: {
    type: String,
    enum: ['payment', 'commission', 'kyc', 'technical', 'links', 'approval', 'products', 'orders', 'shipping', 'return', 'other'],
    default: 'other',
  },
  priority:   { type: String, enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' },
  status:     { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  messages:   [messageSchema],
  attachments: [String],
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastResponseBy: { type: String, enum: ['user', 'support'], default: 'user' },
  userViewed:  { type: Boolean, default: true },
  adminViewed: { type: Boolean, default: false },
}, { timestamps: true });

ticketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

ticketSchema.index({ user: 1, createdAt: -1 });
ticketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
