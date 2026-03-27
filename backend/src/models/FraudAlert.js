/**
 * FraudAlert.js  (updated — chain proof fields added)
 * Place in: backend/models/FraudAlert.js
 *
 * Added fields: chainTxHash, chainEventId
 * These are populated asynchronously after blockchain.logFraudEvent() resolves.
 */

const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  timestamp:     { type: Date, default: Date.now },
  event:         String,
  details:       String,
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  deviceInfo:    String,
  location:      String,
  fraudScore:    Number,
}, { _id: false });

const fraudAlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastSuspiciousTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },

  fraudScore:   { type: Number, default: 0 },
  fraudReason:  { type: String },
  fraudReasons: [String],

  alertLevel:             { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  suspiciousActivityCount: { type: Number, default: 0 },

  status: { type: String, enum: ['pending', 'reviewed', 'auto_blocked', 'approved', 'monitoring'], default: 'pending' },

  // Device & location
  deviceInfo: { deviceId: String, browser: String, userAgent: String, isNewDevice: Boolean },
  locationInfo: { ip: String, city: String, country: String, isNewLocation: Boolean, impossibleTravel: Boolean, lastKnownLocation: String },

  // Velocity snapshot at time of alert
  velocitySnapshot: { last5Min: Number, last1Hour: Number, last24Hours: Number },

  // Recipient risk
  highRiskRecipients: [String],

  // Timeline of events
  timeline: [timelineEventSchema],

  // Bank officer actions
  bankNotes:   String,
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt:  Date,
  autoBlockReason: String,

  // 🔗 Blockchain proof (populated async after on-chain write confirms)
  chainTxHash:  { type: String, default: null },  // Sepolia transaction hash
  chainEventId: { type: String, default: null },  // FraudLog contract eventId

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

fraudAlertSchema.index({ fraudScore: -1, suspiciousActivityCount: -1, updatedAt: -1 });

module.exports = mongoose.model('FraudAlert', fraudAlertSchema);