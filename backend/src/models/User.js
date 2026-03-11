const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'gateway_admin', 'bank_officer'], default: 'user' },
  phone: { type: String, maxlength: 10 },
  upiId: { type: String, unique: true, sparse: true },
  accountNumber: { type: String, maxlength: 16 },
  balance: { type: Number, default: 50000 },
  frozenBalance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'flagged', 'blocked', 'approved'], default: 'active' },
  isSuspended: { type: Boolean, default: false },
  suspendedReason: { type: String },
  suspendedAt: { type: Date },
  blockedIPs: [{ ip: String, blockedAt: Date, reason: String }],
  blockedDevices: [{ fingerprint: String, blockedAt: Date, reason: String }],
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
  ipHistory: [{ ip: String, timestamp: Date, location: String }],
  deviceFingerprints: [{ fingerprint: String, userAgent: String, firstSeen: Date, lastSeen: Date }],
  behaviorProfile: {
    avgTransactionAmount: { type: Number, default: 0 },
    avgDailyTransactions: { type: Number, default: 0 },
    typicalHours: [Number],
    totalTransactions: { type: Number, default: 0 },
    lastTransactionAt: Date,
    anomalyCount: { type: Number, default: 0 },
    totalAmountSpent: { type: Number, default: 0 }
  },
  mlThreshold: {
    maxDailyTransactions: { type: Number, default: 10 },
    maxTransactionAmount: { type: Number, default: 10000 },
    maxHourlyTransactions: { type: Number, default: 5 },
    adaptiveScore: { type: Number, default: 0.5 }
  },
  mlSuspensionReason: { type: String },
  mlFlagReasons: [String],
  notifications: [{
    message: String,
    type: { type: String, enum: ['warning', 'blocked', 'info', 'alert', 'verify'] },
    read: { type: Boolean, default: false },
    requiresAction: { type: Boolean, default: false },
    actionToken: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Single pre-save hook that does both password hashing and riskLevel calculation
userSchema.pre('save', async function(next) {
  // Update riskLevel based on riskScore
  if (this.riskScore >= 80) this.riskLevel = 'critical';
  else if (this.riskScore >= 60) this.riskLevel = 'high';
  else if (this.riskScore >= 35) this.riskLevel = 'medium';
  else this.riskLevel = 'low';

  // Hash password only if modified
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }

  next();
});

userSchema.methods.comparePassword = async function(p) {
  return await bcrypt.compare(p, this.password);
};

module.exports = mongoose.model('User', userSchema);
