const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  message: { type: String, required: true },
}, { timestamps: true });

const contactSubmissionSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  email:   { type: String, required: true },
  phone:   String,
  subject: String,
  message: { type: String, required: true },
  status:  { type: String, enum: ['new', 'read', 'replied', 'resolved', 'spam'], default: 'new' },
  isRead:  { type: Boolean, default: false }, // legacy
  adminNotes: String,
  replies: [replySchema],
  repliedAt:  Date,
  resolvedAt: Date,
}, { timestamps: true });

contactSubmissionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ContactSubmission', contactSubmissionSchema);
