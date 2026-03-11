const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['upi_payment', 'bank_transfer', 'balance_check', 'bill_payment', 'withdrawal', 'top_up'], required: true },
  amount: { type: Number, default: 0 },
  recipientUpi: String,
  recipientAccount: String,
  description: String,

  status: { type: String, enum: ['pending', 'processing', 'approved', 'rejected', 'flagged', 'blocked', 'frozen', 'refunded'], default: 'pending' },
  gatewayDecision: { type: String, enum: ['allow', 'block', 'flag', 'freeze', 'pending'], default: 'pending' },
  bankDecision: { type: String, enum: ['approved', 'rejected', 'pending', 'investigating', 'refunded'], default: 'pending' },

  // Security analysis
  securityChecks: {
    ipCheck: { passed: Boolean, details: String },
    velocityCheck: { passed: Boolean, details: String },
    amountCheck: { passed: Boolean, details: String },
    behaviorCheck: { passed: Boolean, details: String },
    deviceCheck: { passed: Boolean, details: String },
    balanceCheck: { passed: Boolean, details: String },
    mlAnomalyScore: { type: Number, default: 0 },
    mlDecision: { type: String, enum: ['normal', 'anomaly', 'unknown'], default: 'unknown' },
    mlReasons: [String],
    overallRiskScore: { type: Number, default: 0 }
  },

  // Session/device/location metadata
  sessionData: {
    deviceId: String,
    browser: String,
    ipAddress: String,
    location: String,
    sessionId: String,
    userAgent: String,
    isNewDevice: Boolean,
    isNewLocation: Boolean,
    impossibleTravel: Boolean
  },

  // Behavioral biometrics snapshot
  biometrics: {
    typingSpeed: Number,
    sessionInteractionTime: Number,
    behaviorScore: Number,
    anomaly: Boolean
  },

  threatFlags: [String],
  reviewNotes: String,
  frozenAmount: { type: Number, default: 0 },
  refundedAmount: { type: Number, default: 0 },
  refundedAt: Date,
  processedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);