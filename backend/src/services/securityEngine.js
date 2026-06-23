const geoip = require('geoip-lite');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mlService = require('./mlService');
const { redis, isReady: isRedisReady } = require('../config/redis');

// ── Nonce Store (Redis primary, in-memory fallback) ─────────────────────────
const NONCE_TTL_SECONDS = 600; // 10 minutes
const fallbackNonces = new Set(); // Only used when Redis is down

async function hasNonce(nonce) {
  if (isRedisReady()) {
    return await redis.exists(`nonce:${nonce}`);
  }
  return fallbackNonces.has(nonce);
}

async function addNonce(nonce) {
  if (isRedisReady()) {
    await redis.set(`nonce:${nonce}`, '1', 'EX', NONCE_TTL_SECONDS);
  } else {
    fallbackNonces.add(nonce);
    // Crude cleanup for fallback only
    if (fallbackNonces.size > 10000) {
      const arr = [...fallbackNonces];
      arr.slice(0, 5000).forEach(n => fallbackNonces.delete(n));
    }
  }
}

function calcRiskLevel(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

async function analyzeTransaction(userId, txData, requestMeta) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const checks = {
    ipCheck: { passed: true, details: '' },
    velocityCheck: { passed: true, details: '' },
    amountCheck: { passed: true, details: '' },
    behaviorCheck: { passed: true, details: '' },
    deviceCheck: { passed: true, details: '' },
    balanceCheck: { passed: true, details: '' },
    mlAnomalyScore: 0, mlDecision: 'unknown', mlReasons: [], overallRiskScore: 0
  };
  const threatFlags = [];
  const mlReasons = [];
  let riskScore = 0;

  // 1. Balance
  if (txData.amount > 0 && txData.type !== 'top_up') {
    if (user.balance < txData.amount) {
      checks.balanceCheck = { passed: false, details: `Insufficient: Rs.${user.balance} available, Rs.${txData.amount} requested` };
      return { checks: { ...checks, overallRiskScore: 0 }, threatFlags: ['insufficient_balance'], riskScore: 0, gatewayDecision: 'block', mlReasons: ['Insufficient balance'], sessionData: buildSessionData(requestMeta, user) };
    }
  }

  // 2. Velocity (DB-based)
  const now = Date.now();
  const [cnt5m, cnt1h, cnt24h] = await Promise.all([
    Transaction.countDocuments({ userId, createdAt: { $gte: new Date(now - 5 * 60000) } }),
    Transaction.countDocuments({ userId, createdAt: { $gte: new Date(now - 3600000) } }),
    Transaction.countDocuments({ userId, createdAt: { $gte: new Date(now - 86400000) } })
  ]);
  // Update velocity on user
  await User.findByIdAndUpdate(userId, { velocity: { last5Min: cnt5m, last1Hour: cnt1h, last24Hours: cnt24h, updatedAt: new Date() } });

  if (cnt5m >= 3) {
    checks.velocityCheck = { passed: false, details: `${cnt5m} transactions in last 5 minutes (max: 3). Burst detected.` };
    riskScore += 40; threatFlags.push('velocity_attack'); mlReasons.push(`Transaction burst: ${cnt5m} in 5 min`);
  } else if (cnt1h >= 10) {
    checks.velocityCheck = { passed: false, details: `${cnt1h} transactions in last hour (max: 10).` };
    riskScore += 20; threatFlags.push('velocity_high'); mlReasons.push(`High velocity: ${cnt1h} in 1 hour`);
  }

  // 3. IP / geo
  const geo = geoip.lookup(requestMeta.ip);
  const location = geo ? `${geo.city || 'Unknown'}, ${geo.country || 'XX'}` : 'Local';
  const knownIps = (user.ipHistory || []).map(h => h.ip);
  let isNewLocation = false;
  let impossibleTravel = false;

  if (knownIps.length > 0 && !knownIps.includes(requestMeta.ip)) {
    const lastEntry = user.ipHistory[user.ipHistory.length - 1];
    if (lastEntry?.location && lastEntry.location !== location && location !== 'Local') {
      const timeDiff = (new Date() - new Date(lastEntry.timestamp)) / 60000;
      if (timeDiff < 30) { impossibleTravel = true; riskScore += 35; threatFlags.push('impossible_travel'); mlReasons.push(`Impossible travel: ${lastEntry.location} → ${location} in ${timeDiff.toFixed(0)} min`); }
      else { isNewLocation = true; riskScore += 15; threatFlags.push('new_location'); mlReasons.push(`New location: ${location}`); }
      checks.ipCheck = { passed: false, details: `Location changed: ${lastEntry.location} → ${location}` };
    }
  }

  // 4. Device
  const fp = requestMeta.deviceFingerprint;
  let isNewDevice = false;
  const knownDevices = (user.deviceFingerprints || []).map(d => d.fingerprint);
  if (fp && fp !== 'unknown' && knownDevices.length > 0 && !knownDevices.includes(fp)) {
    isNewDevice = true; riskScore += 15; threatFlags.push('new_device'); mlReasons.push('Unrecognized device');
    checks.deviceCheck = { passed: false, details: 'New device fingerprint detected' };
  }

  // 5. Amount anomaly
  if (txData.amount > 0) {
    const avg = user.behaviorProfile?.avgTransactionAmount || 0;
    if (avg > 100 && txData.amount > avg * 4) {
      riskScore += 20; threatFlags.push('amount_anomaly'); mlReasons.push(`Amount Rs.${txData.amount} is ${(txData.amount / avg).toFixed(1)}x your average (Rs.${avg.toFixed(0)})`);
      checks.amountCheck = { passed: false, details: `Rs.${txData.amount} vs avg Rs.${avg.toFixed(0)}` };
    }
  }

  // 6. Replay attack (Redis-backed with fallback)
  if (requestMeta.nonce && await hasNonce(requestMeta.nonce)) {
    riskScore += 50; threatFlags.push('replay_attack'); mlReasons.push('Duplicate nonce — replay attack');
  } else if (requestMeta.nonce) {
    await addNonce(requestMeta.nonce);
  }

  // 7. ML
  try {
    const mlResult = await mlService.analyzeAnomaly(userId, {
      amount: txData.amount || 0, hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      ipChanged: isNewLocation || impossibleTravel ? 1 : 0,
      deviceChanged: isNewDevice ? 1 : 0,
      velocityScore: cnt5m / 3,
      userAvgAmount: user.behaviorProfile?.avgTransactionAmount || 0,
      totalTransactions: user.behaviorProfile?.totalTransactions || 0
    });
    checks.mlAnomalyScore = mlResult.anomalyScore;
    checks.mlDecision = mlResult.decision;
    if (mlResult.decision === 'anomaly') {
      riskScore += Math.round(mlResult.anomalyScore * 20);
      threatFlags.push('ml_anomaly');
      mlReasons.push(`ML Isolation Forest: ${(mlResult.anomalyScore * 100).toFixed(0)}% anomaly confidence`);
    }
  } catch (e) {}

  checks.overallRiskScore = Math.min(100, Math.round(riskScore));
  checks.mlReasons = mlReasons;

  // Gateway decision: flag instead of block for suspicious (unless very high risk)
  let gatewayDecision = 'allow';
  if (riskScore >= 70) gatewayDecision = 'block';
  else if (riskScore >= 25) gatewayDecision = 'flag';

  const sessionData = buildSessionData(requestMeta, user, location, isNewDevice, isNewLocation, impossibleTravel);
  const velocitySnapshot = { last5Min: cnt5m, last1Hour: cnt1h, last24Hours: cnt24h };

  return { checks, threatFlags, riskScore: checks.overallRiskScore, gatewayDecision, mlReasons, sessionData, velocitySnapshot };
}

function buildSessionData(requestMeta, user, location, isNewDevice, isNewLocation, impossibleTravel) {
  return {
    deviceId: requestMeta.deviceFingerprint,
    browser: requestMeta.userAgent?.split(' ').slice(-1)[0] || 'Unknown',
    ipAddress: requestMeta.ip,
    location: location || 'Local',
    sessionId: requestMeta.nonce,
    userAgent: requestMeta.userAgent,
    isNewDevice: !!isNewDevice,
    isNewLocation: !!isNewLocation,
    impossibleTravel: !!impossibleTravel
  };
}

async function updateUserProfile(userId, txData) {
  const user = await User.findById(userId);
  if (!user) return;
  const profile = user.behaviorProfile || {};
  const total = profile.totalTransactions || 0;
  const hour = new Date().getHours();
  const typicalHours = profile.typicalHours || [];
  if (!typicalHours.includes(hour)) { typicalHours.push(hour); if (typicalHours.length > 16) typicalHours.shift(); }
  const newAvg = txData.amount > 0 ? ((profile.avgTransactionAmount * total) + txData.amount) / (total + 1) : profile.avgTransactionAmount || 0;

  const updateData = {
    'behaviorProfile.avgTransactionAmount': newAvg,
    'behaviorProfile.totalAmountSpent': (profile.totalAmountSpent || 0) + (txData.amount || 0),
    'behaviorProfile.typicalHours': typicalHours,
    'behaviorProfile.totalTransactions': total + 1,
    'behaviorProfile.lastTransactionAt': new Date()
  };
  if (txData.recipientUpi) {
    const recips = profile.frequentRecipients || [];
    if (!recips.includes(txData.recipientUpi)) { recips.push(txData.recipientUpi); if (recips.length > 20) recips.shift(); }
    updateData['behaviorProfile.frequentRecipients'] = recips;
  }
  await User.findByIdAndUpdate(userId, updateData);
}

async function updateIPHistory(userId, ip) {
  const geo = geoip.lookup(ip);
  const location = geo ? `${geo.city || 'Unknown'}, ${geo.country || 'XX'}` : 'Local';
  await User.findByIdAndUpdate(userId, { $push: { ipHistory: { $each: [{ ip, timestamp: new Date(), location }], $slice: -30 } } });
}

async function updateDeviceHistory(userId, fingerprint, userAgent) {
  if (!fingerprint || fingerprint === 'unknown') return;
  const user = await User.findById(userId);
  if (!user) return;
  const existing = user.deviceFingerprints?.find(d => d.fingerprint === fingerprint);
  if (existing) {
    await User.updateOne({ _id: userId, 'deviceFingerprints.fingerprint': fingerprint }, { $set: { 'deviceFingerprints.$.lastSeen': new Date() } });
  } else {
    await User.findByIdAndUpdate(userId, { $push: { deviceFingerprints: { fingerprint, userAgent, firstSeen: new Date(), lastSeen: new Date() } } });
  }
}

async function updateRiskScore(userId, riskScore, mlReasons) {
  const score = Math.min(100, riskScore);
  await User.findByIdAndUpdate(userId, {
    riskScore: score,
    riskLevel: calcRiskLevel(score),
    ...(mlReasons?.length ? { mlFlagReasons: mlReasons } : {})
  });
}

module.exports = { analyzeTransaction, updateUserProfile, updateIPHistory, updateDeviceHistory, updateRiskScore };