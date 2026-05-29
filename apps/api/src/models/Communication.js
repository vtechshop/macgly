const mongoose = require('mongoose');

const communicationSchema = new mongoose.Schema({
  type:      { type: String, enum: ['email', 'whatsapp', 'sms', 'marketing', 'notification', 'support'], required: true },
  direction: { type: String, enum: ['incoming', 'outgoing'], default: 'outgoing' },
  from:      String,
  fromName:  String,
  to:        String,
  toName:    String,
  subject:   String,
  message:   String,
  htmlContent: String,
  status:    { type: String, enum: ['pending', 'sent', 'delivered', 'failed', 'read'], default: 'pending' },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attachments: [String],
  metadata:  { type: mongoose.Schema.Types.Mixed },
  tags:      [String],
  priority:  { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  errorMessage: String,
  sentAt:     Date,
  deliveredAt: Date,
  readAt:     Date,
  failedAt:   Date,
  replyTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'Communication' },
}, { timestamps: true });

communicationSchema.index({ type: 1, createdAt: -1 });
communicationSchema.index({ status: 1, createdAt: -1 });
communicationSchema.index({ userId: 1 });

module.exports = mongoose.model('Communication', communicationSchema);
