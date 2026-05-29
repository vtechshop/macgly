const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  slug:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  excerpt:      { type: String, trim: true },
  content:      { type: String, required: true },
  coverImage:   String,
  featuredImage: String,
  author:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags:         [String],
  category:     String,
  type:         { type: String, enum: ['post', 'video'], default: 'post' },
  status:       { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  isPublished:  { type: Boolean, default: false }, // legacy
  publishedAt:  Date,
  views:        { type: Number, default: 0 },
  likes:        { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  readingTime:  Number,
}, { timestamps: true });

blogSchema.index({ isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
