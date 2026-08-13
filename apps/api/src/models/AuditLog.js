const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorRole:   { type: String, default: 'system' },
  action:      { type: String, required: true },
  target:      { type: mongoose.Schema.Types.ObjectId, default: null },
  targetModel: { type: String, default: null },
  ip:          { type: String, default: null },
  userAgent:   { type: String, default: null },
  meta:        { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, versionKey: false });

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ target: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// Audit logs are immutable — block updates and deletes at the model layer
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'], function () {
  throw new Error('AuditLog records are immutable');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
