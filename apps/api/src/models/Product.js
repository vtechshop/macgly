const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  sku: { type: String, required: true, unique: true },
  brand: { type: String, trim: true },
  tags: [String],

  price: { type: Number, required: true, min: 0 },
  compareAt: {
    type: Number,
    min: 0,
    validate: {
      validator: function (v) { return v == null || v >= this.price; },
      message: 'compareAt must be >= price',
    },
  },

  stock: { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 5 },

  images: [String],
  imageAlts: [String],

  category: { type: String, trim: true, lowercase: true },
  categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  published: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },

  gstRate: { type: Number, default: 18, enum: [0, 5, 12, 18, 28] },
  hsn: { type: String, trim: true },

  weight: { type: Number, default: 0 },
  shippingCharge: { type: Number, default: 0 },
  delhiveryEnabled: { type: Boolean, default: true },

  seo: {
    title: String,
    description: String,
    keywords: String,
  },

  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },

  warranty: {
    duration: Number,
    durationType: { type: String, enum: ['days', 'months', 'years'] },
    description: String,
  },

  faqs: [{ question: String, answer: String }],
  specifications: [{ label: String, value: String }],

  hasVariants: { type: Boolean, default: false },
  variantOptions: [{ name: String, values: [String] }],
  variants: [{
    sku: String,
    attributes: { type: Map, of: String },
    price: Number,
    compareAt: Number,
    stock: { type: Number, default: 0 },
    images: [String],
  }],
}, { timestamps: true });

productSchema.index({ published: 1, displayOrder: -1 });
productSchema.index({ category: 1 });
productSchema.index({ categoryIds: 1 });
productSchema.index({ vendorId: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ title: 'text', description: 'text', tags: 'text', brand: 'text' });

module.exports = mongoose.model('Product', productSchema);
