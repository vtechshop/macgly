const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true },
  description: String,
  image:       String,
  parentId:    { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  isActive:    { type: Boolean, default: true },
  displayOrder:{ type: Number, default: 0 },   // legacy field — kept for admin catalog
  sortOrder:   { type: Number, default: 0 },   // vendor-facing sort (higher = first)

  // Vendor-created category tracking
  createdBy:          { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deleteRequested:    { type: Boolean, default: false },
  deleteRequestedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deleteRequestedAt:  { type: Date, default: null },

  // Optional: filterable attributes for products in this category
  attributes: [{
    name:     String,
    type:     { type: String, enum: ['text', 'number', 'select', 'multiselect'], default: 'text' },
    options:  [String],
    required: Boolean,
  }],

  seo: {
    title:       String,
    description: String,
    keywords:    [String],
  },
}, { timestamps: true });

categorySchema.index({ parentId: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ createdBy: 1 });
categorySchema.index({ sortOrder: -1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);
