const mongoose = require('mongoose');
const crypto = require('crypto');

const newsletterSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: String,
  isActive: { type: Boolean, default: true },
  token: { type: String, default: () => crypto.randomBytes(24).toString('hex') }, // for unsubscribe link
  source: { type: String, default: 'website' }, // website, checkout, popup
}, { timestamps: true });

module.exports = mongoose.model('Newsletter', newsletterSchema);
