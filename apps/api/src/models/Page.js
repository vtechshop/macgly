const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  content: { type: String, required: true },
  metaTitle: String,
  metaDescription: String,
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Page', pageSchema);
