const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  description: String,
}, { timestamps: true });

module.exports = mongoose.model('AppConfig', appConfigSchema);
