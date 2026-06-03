const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label: String,
  name: String,
  phone: String,
  line1: String,
  line2: String,
  city: String,
  state: String,
  pincode: String,
  country: { type: String, default: 'India' },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'vendor', 'customer', 'affiliate'], default: 'customer' },

  avatar: String,
  addresses: [addressSchema],

  // Vendor-specific
  vendorProfile: {
    storeName:         String,
    storeDescription:  String,
    businessName:      String,
    businessPhone:     String,
    gstin:             String,
    bankAccount:       String,
    ifsc:              String,
    accountHolderName: String,
    bankName:          String,
    upiId:             String,
    panCard:           String,
    businessType:      String,
    onboardingComplete: { type: Boolean, default: false },
    approved:          { type: Boolean, default: false },
    rejectionReason:   { type: String, default: '' },
    commissionRate:    { type: Number, default: 10 },
    commissionRules:   [{ category: String, percentage: Number }],
    totalEarnings:     { type: Number, default: 0 },
    // KYC fields
    businessAddress:   String,
    kycStatus:         { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' },
    gstVerified:       { type: Boolean, default: false },
    gstDetails: {
      tradeName: String, legalName: String, gstNumber: String, status: String, address: String,
    },
    kycDocuments: [{
      type:       { type: String, enum: ['id_proof', 'address_proof', 'business_license', 'tax_certificate'] },
      url:        String,
      filename:   String,
      uploadedAt: { type: Date, default: Date.now },
    }],
    kycRejectionReason: String,
    kycVerifiedAt:      Date,
    kycVerifiedBy:      mongoose.Schema.Types.ObjectId,
    // Store branding & settings
    logo:              String,
    slug:              String,
    swiftCode:         String,
    returnPolicy:      String,
    shippingPolicy:    String,
  },

  // Affiliate-specific
  affiliateProfile: {
    referralCode:     { type: String, unique: true, sparse: true },
    commissionRate:   { type: Number, default: 5 },
    commissionRules:  [{ category: String, percentage: Number }],
    totalEarnings:    { type: Number, default: 0 },
    pendingEarnings:  { type: Number, default: 0 },
    paidEarnings:     { type: Number, default: 0 },
    totalClicks:      { type: Number, default: 0 },
    totalConversions: { type: Number, default: 0 },
    rejectionReason:  { type: String, default: '' },
    approvedAt:       Date,
    kycStatus: { type: String, enum: ['not_submitted', 'pending', 'verified', 'rejected'], default: 'not_submitted' },
    kycData: {
      panCard:           String,
      accountHolderName: String,
      bankAccount:       String,
      bankName:          String,
      upiId:             String,
      ifsc:              String,
      aadhaar:           String,
      rejectionReason:   String,
    },
    // Extended KYC fields (full verification form)
    kycFullName:    String,
    kycAddress:     String,
    kycCity:        String,
    kycState:       String,
    kycCountry:     String,
    kycZipCode:     String,
    kycPhoneNumber: String,
    kycIdType:      { type: String, enum: ['passport', 'drivers_license', 'national_id', 'other'] },
    kycIdNumber:    String,
    kycGstNumber:   String,
    kycGstVerified: { type: Boolean, default: false },
    kycGstDetails:  mongoose.Schema.Types.Mixed,
    kycDocuments:   [{
      type:       { type: String },
      url:        String,
      filename:   String,
      uploadedAt: { type: Date, default: Date.now },
    }],
    kycVerifiedAt:      Date,
    kycRejectionReason: String,
    // Payment/bank details (separate from kycData)
    panNumber:   String,
    panVerified: { type: Boolean, default: false },
    bankDetails: {
      accountHolderName: String,
      bankName:          String,
      accountNumber:     String,
      lastFourDigits:    String,
      ifscCode:          String,
      upiId:             String,
      verified:          { type: Boolean, default: false },
    },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      showEarnings:       { type: Boolean, default: true },
      soundEnabled:       { type: Boolean, default: true },
      weeklyReports:      { type: Boolean, default: true },
      monthlyReports:     { type: Boolean, default: true },
      promotionalEmails:  { type: Boolean, default: false },
      currency:           { type: String,  default: 'INR' },
      language:           { type: String,  default: 'en' },
    },
  },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
  pendingAffiliateRef: { type: String, default: null }, // referral code of last clicked affiliate link

  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil:     Date,
  refreshTokens: { type: [String], select: false },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  passwordResetToken: String,
  passwordResetExpires: Date,
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
