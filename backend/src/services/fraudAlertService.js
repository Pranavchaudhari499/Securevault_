const FraudAlert = require('../models/FraudAlert');
const User = require('../models/User');
const geoip = require('geoip-lite');

const AUTO_BLOCK_THRESHOLD = 10; // auto-block after 10 genuinely suspicious activities

function getAlertLevel(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function safeEmit(io, room, event, data) {
  try { if (io && typeof io.to === 'function') io.to(room).emit(event, data); } catch (e) {}
}

async function upsertFraudAlert({ userId, transactionId, fraudScore, fraudReasons, sessionData, velocitySnapshot, io }) {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const reasons = Array.isArray(fraudReasons) ? fraudReasons : [fraudReasons].filter(Boolean);
    const level = getAlertLevel(fraudScore);

    // Build timeline event
    const timelineEvent = {
      timestamp: new Date(),
      event: fraudScore >= 60 ? 'High-risk transaction blocked' : 'Suspicious transaction flagged',
      details: reasons.slice(0, 2).join('. '),
      transactionId,
      deviceInfo: sessionData?.deviceId || sessionData?.browser || 'Unknown device',
      location: sessionData?.location || sessionData?.ipAddress || 'Unknown',
      fraudScore
    };

    if (sessionData?.isNewDevice) timelineEvent.event = 'New device detected — ' + timelineEvent.event;
    if (sessionData?.impossibleTravel) timelineEvent.event = 'Impossible travel anomaly — ' + timelineEvent.event;

    // Check if alert exists for this user
    let alert = await FraudAlert.findOne({ userId });

    if (alert) {
      // Update existing alert
      alert.fraudScore = Math.max(alert.fraudScore, fraudScore);
      alert.fraudReason = reasons[0] || alert.fraudReason;
      alert.fraudReasons = [...new Set([...alert.fraudReasons, ...reasons])].slice(0, 10);
      alert.alertLevel = getAlertLevel(alert.fraudScore);
      alert.suspiciousActivityCount += 1;
      alert.lastSuspiciousTransactionId = transactionId;
      alert.updatedAt = new Date();
      alert.timeline.push(timelineEvent);
      if (alert.timeline.length > 50) alert.timeline = alert.timeline.slice(-50);

      // Update device/location info
      if (sessionData?.deviceId) alert.deviceInfo = { deviceId: sessionData.deviceId, browser: sessionData.browser, userAgent: sessionData.userAgent, isNewDevice: !!sessionData.isNewDevice };
      if (sessionData?.location) alert.locationInfo = { ip: sessionData.ipAddress, city: sessionData.location, isNewLocation: !!sessionData.isNewLocation, impossibleTravel: !!sessionData.impossibleTravel, lastKnownLocation: sessionData.location };
      if (velocitySnapshot) alert.velocitySnapshot = velocitySnapshot;

    } else {
      // Create new alert
      alert = new FraudAlert({
        userId,
        lastSuspiciousTransactionId: transactionId,
        fraudScore,
        fraudReason: reasons[0] || 'Suspicious activity',
        fraudReasons: reasons,
        alertLevel: level,
        suspiciousActivityCount: 1,
        status: 'pending',
        deviceInfo: { deviceId: sessionData?.deviceId, browser: sessionData?.browser, userAgent: sessionData?.userAgent, isNewDevice: !!sessionData?.isNewDevice },
        locationInfo: { ip: sessionData?.ipAddress, city: sessionData?.location, isNewLocation: !!sessionData?.isNewLocation, impossibleTravel: !!sessionData?.impossibleTravel },
        velocitySnapshot: velocitySnapshot || {},
        timeline: [timelineEvent]
      });
    }

    // Auto-block logic
    let autoBlocked = false;
    if (alert.suspiciousActivityCount >= AUTO_BLOCK_THRESHOLD && user.status !== 'blocked') {
      const blockReason = `Auto-blocked: ${alert.suspiciousActivityCount} suspicious activities detected. Last reason: ${reasons[0]}`;
      await User.findByIdAndUpdate(userId, {
        status: 'blocked',
        isSuspended: true,
        suspendedReason: blockReason,
        suspendedAt: new Date(),
        flaggedActivityCount: alert.suspiciousActivityCount
      });
      alert.status = 'auto_blocked';
      alert.autoBlockReason = blockReason;
      alert.timeline.push({
        timestamp: new Date(),
        event: 'USER AUTOMATICALLY BLOCKED',
        details: blockReason,
        fraudScore: alert.fraudScore
      });
      autoBlocked = true;

      // Notify user
      await User.findByIdAndUpdate(userId, {
        $push: { notifications: { message: `Your account has been blocked due to repeated suspicious activity (${alert.suspiciousActivityCount} incidents). Contact your bank.`, type: 'blocked', createdAt: new Date() } }
      });

      safeEmit(io, `user-${userId}`, 'account-blocked', { message: blockReason });
    } else if (user.status === 'active') {
      await User.findByIdAndUpdate(userId, {
        status: 'flagged',
        riskScore: Math.max(user.riskScore, fraudScore),
        flaggedActivityCount: alert.suspiciousActivityCount,
        lastSuspiciousActivity: new Date(),
        mlFlagReasons: reasons
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        riskScore: Math.max(user.riskScore, fraudScore),
        flaggedActivityCount: alert.suspiciousActivityCount,
        lastSuspiciousActivity: new Date(),
        mlFlagReasons: reasons
      });
    }

    await alert.save();

    // Emit to bank and gateway in real time
    const populated = await FraudAlert.findById(alert._id).populate('userId', 'name email upiId accountNumber riskScore status flaggedActivityCount velocity');
    safeEmit(io, 'bank-room', 'fraud-alert-update', populated);
    safeEmit(io, 'gateway-room', 'fraud-alert-update', populated);

    return { alert: populated, autoBlocked };
  } catch (e) {
    console.error('upsertFraudAlert error:', e.message);
    return null;
  }
}

async function getAlertsForBank(status) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  return FraudAlert.find(filter)
    .populate('userId', 'name email upiId accountNumber riskScore riskLevel status flaggedActivityCount velocity behaviorProfile')
    .populate('lastSuspiciousTransactionId')
    .sort({ fraudScore: -1, suspiciousActivityCount: -1, updatedAt: -1 })
    .limit(100);
}

module.exports = { upsertFraudAlert, getAlertsForBank };