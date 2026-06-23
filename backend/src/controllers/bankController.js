/**
 * bankController.js  (updated — blockchain integrated)
 * Changes: logUserAction() calls added to approveUser, blockUser, unblockUser, increaseMonitoring
 * Also adds: getBlockchainStatus, verifyOnChain
 */

const User       = require('../models/User');
const Transaction = require('../models/Transaction');
const FraudAlert = require('../models/FraudAlert');
const { getAlertsForBank } = require('../services/fraudAlertService');
const blockchain = require('../services/blockchainService');   // ← NEW
const { redis, isReady: isRedisReady } = require('../config/redis');
const { invalidateUserCache, invalidateDashboardCache } = require('../utils/cacheInvalidation');

function safeEmit(io, room, event, data) {
  try { if (io && typeof io.to === 'function') io.to(room).emit(event, data); } catch (e) {}
}

// ── Dashboard (Redis cached, 30s TTL) ─────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const CACHE_KEY = 'cache:bank:dashboard';

    // Serve from cache if available
    if (isRedisReady()) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json(JSON.parse(cached));
    }

    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

    const [totalUsers, pendingReview, fraudAlerts, approvedToday] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      FraudAlert.countDocuments({ status: 'pending' }),
      FraudAlert.countDocuments({ alertLevel: 'critical', status: { $ne: 'approved' } }),
      Transaction.countDocuments({ status: 'approved', createdAt: { $gte: today, $lte: todayEnd } }),
    ]);

    const last7 = new Date(Date.now() - 7 * 86400000);
    const volumeTrend = await Transaction.aggregate([
      { $match: { createdAt: { $gte: last7 } } },
      { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, total: { $sum: 1 }, blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]);

    const pendingTransactions = await Transaction.find({ status: 'flagged' })
      .populate('userId', 'name email riskScore status').sort({ createdAt: -1 }).limit(10);

    const recentAlerts = await FraudAlert.find({ status: { $nin: ['approved'] } })
      .populate('userId', 'name email status riskScore').sort({ fraudScore: -1, suspiciousActivityCount: -1 }).limit(5);

    const result = { success: true, stats: { totalUsers, pendingReview, fraudAlerts, approvedToday }, volumeTrend, pendingTransactions, recentAlerts };

    // Cache for 30 seconds
    if (isRedisReady()) await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', 30);

    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Fraud alerts ───────────────────────────────────────────────────────────────
exports.getFraudAlerts = async (req, res) => {
  try {
    const { status } = req.query;
    const flaggedOrBlocked = await User.find({ role: 'user', status: { $in: ['blocked', 'flagged'] } }).select('_id status riskScore suspendedReason');
    for (const u of flaggedOrBlocked) {
      const existing = await FraudAlert.findOne({ userId: u._id });
      if (!existing) {
        await FraudAlert.create({
          userId: u._id, fraudScore: u.riskScore || 60, fraudReason: u.suspendedReason || 'Account flagged during session',
          fraudReasons: [u.suspendedReason || 'Repeated suspicious activity detected'],
          alertLevel: u.status === 'blocked' ? 'high' : 'medium', suspiciousActivityCount: 1,
          status: u.status === 'blocked' ? 'auto_blocked' : 'pending',
          timeline: [{ timestamp: new Date(), event: u.status === 'blocked' ? 'Account auto-blocked' : 'Account flagged', details: u.suspendedReason || 'Flagged during payment session', fraudScore: u.riskScore || 60 }]
        });
      }
    }
    const alerts = await getAlertsForBank(status);
    res.json({ success: true, alerts });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Approve user ───────────────────────────────────────────────────────────────
exports.approveUser = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { userId } = req.params;
    const { notes }  = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'active', riskScore: 10, riskLevel: 'low', flaggedActivityCount: 0, mlFlagReasons: [], isSuspended: false, suspendedReason: null },
      { new: true }
    );

    await FraudAlert.findOneAndUpdate(
      { userId },
      { status: 'approved', bankNotes: notes, reviewedBy: req.user.id, reviewedAt: new Date(),
        $push: { timeline: { timestamp: new Date(), event: 'Bank officer approved user', details: notes || 'Cleared by bank' } } }
    );

    // 🔗 Blockchain log (non-blocking)
    blockchain.logUserAction({ userId, action: 'bank_approved', notes: notes || 'Cleared by bank officer' });

    // Bust cache so next dashboard load reflects changes
    await Promise.all([
      invalidateUserCache(userId),
      invalidateDashboardCache('bank'),
      invalidateDashboardCache('gateway'),
    ]);

    safeEmit(io, `user-${userId}`,  'notification',    { message: 'Your account has been reviewed and cleared by the bank.', type: 'info' });
    safeEmit(io, 'bank-room',       'user-approved',   { user: { _id: userId, name: user.name, email: user.email } });
    safeEmit(io, 'gateway-room',    'user-status-update', { userId, status: 'active' });

    res.json({ success: true, message: 'User approved and cleared' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Block user ─────────────────────────────────────────────────────────────────
exports.blockUser = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { userId } = req.params;
    const { notes }  = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'blocked', isSuspended: true, suspendedReason: notes || 'Blocked by bank officer', suspendedAt: new Date() },
      { new: true }
    );

    await FraudAlert.findOneAndUpdate(
      { userId },
      { status: 'auto_blocked', bankNotes: notes, reviewedBy: req.user.id, reviewedAt: new Date(),
        $push: { timeline: { timestamp: new Date(), event: 'Bank officer permanently blocked user', details: notes || 'Manual block' } } }
    );

    // 🔗 Blockchain log (non-blocking)
    blockchain.logUserAction({ userId, action: 'bank_blocked', notes: notes || 'Manual block by bank officer' });

    await Promise.all([
      invalidateUserCache(userId),
      invalidateDashboardCache('bank'),
      invalidateDashboardCache('gateway'),
    ]);

    safeEmit(io, `user-${userId}`, 'account-blocked',  { message: `Your account has been permanently blocked. Reason: ${notes}` });
    safeEmit(io, 'bank-room',      'user-blocked',     { user: { _id: userId, name: user.name, email: user.email } });
    safeEmit(io, 'gateway-room',   'user-status-update', { userId, status: 'blocked' });

    res.json({ success: true, message: 'User blocked' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Unblock user ───────────────────────────────────────────────────────────────
exports.unblockUser = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { userId } = req.params;
    const { notes }  = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'active', isSuspended: false, suspendedReason: null, suspendedAt: null, riskScore: 15, riskLevel: 'low', flaggedActivityCount: 0, mlFlagReasons: [] },
      { new: true }
    );

    await FraudAlert.findOneAndUpdate(
      { userId },
      { status: 'approved', bankNotes: notes || 'Unblocked by bank officer', reviewedBy: req.user.id, reviewedAt: new Date(),
        $push: { timeline: { timestamp: new Date(), event: 'Bank officer unblocked user', details: notes || 'Account restored', fraudScore: 0 } } }
    );

    // 🔗 Blockchain log (non-blocking)
    blockchain.logUserAction({ userId, action: 'bank_unblocked', notes: notes || 'Account restored by bank officer' });

    await Promise.all([
      invalidateUserCache(userId),
      invalidateDashboardCache('bank'),
      invalidateDashboardCache('gateway'),
    ]);

    safeEmit(io, `user-${userId}`, 'notification',       { message: 'Your account has been unblocked by the bank. You may now transact normally.', type: 'info' });
    safeEmit(io, 'bank-room',      'user-unblocked',     { user: { _id: userId, name: user.name, email: user.email } });
    safeEmit(io, 'gateway-room',   'user-status-update', { userId, status: 'active' });

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Increase monitoring ────────────────────────────────────────────────────────
exports.increaseMonitoring = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes }  = req.body;

    await FraudAlert.findOneAndUpdate(
      { userId },
      { status: 'monitoring', bankNotes: notes, reviewedBy: req.user.id, reviewedAt: new Date(),
        $push: { timeline: { timestamp: new Date(), event: 'Increased monitoring activated by bank', details: notes || 'Under close observation' } } }
    );

    // 🔗 Blockchain log (non-blocking)
    blockchain.logUserAction({ userId, action: 'bank_monitoring', notes: notes || 'Increased monitoring activated' });

    res.json({ success: true, message: 'User placed under increased monitoring' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── High risk users ────────────────────────────────────────────────────────────
exports.getHighRiskUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user', status: { $in: ['flagged', 'blocked'] } })
      .select('-password').sort({ riskScore: -1 }).limit(50);
    res.json({ success: true, users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Network graph ──────────────────────────────────────────────────────────────
exports.getNetworkGraph = async (req, res) => {
  try {
    const flaggedTxns = await Transaction.find({ status: { $in: ['flagged', 'blocked'] } })
      .populate('userId',    'name email status riskScore')
      .populate('recipientId', 'name email status riskScore').limit(100);

    const nodes = new Map(); const edges = []; const ipGroups = new Map();

    for (const tx of flaggedTxns) {
      if (!tx.userId) continue;
      const uid = tx.userId._id.toString();
      if (!nodes.has(uid)) nodes.set(uid, { id: uid, type: 'user', label: tx.userId.name || tx.userId.email, risk: tx.userId.riskScore || 0, status: tx.userId.status });
      if (tx.recipientId) {
        const rid = tx.recipientId._id.toString();
        if (!nodes.has(rid)) nodes.set(rid, { id: rid, type: 'recipient', label: tx.recipientId.name || tx.recipientId.email, risk: tx.recipientId.riskScore || 0, status: tx.recipientId.status });
        edges.push({ from: uid, to: rid, label: `Rs.${tx.amount}`, type: 'transaction' });
      }
      const ip = tx.sessionData?.ipAddress;
      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        const ipId = `ip_${ip}`;
        if (!nodes.has(ipId)) nodes.set(ipId, { id: ipId, type: 'ip', label: ip, risk: 0 });
        edges.push({ from: uid, to: ipId, type: 'ip_link' });
        if (!ipGroups.has(ip)) ipGroups.set(ip, []);
        ipGroups.get(ip).push(uid);
      }
    }

    for (const [ip, users] of ipGroups) {
      if (users.length > 1) { const node = nodes.get(`ip_${ip}`); if (node) { node.risk = 80; node.label = `${ip} (shared by ${users.length})`; } }
    }

    res.json({ success: true, nodes: [...nodes.values()], edges });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── 🔗 NEW: Blockchain status (health check for bank portal) ──────────────────
exports.getBlockchainStatus = async (req, res) => {
  try {
    const status = await blockchain.getStatus();
    res.json({ success: true, blockchain: status });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── 🔗 NEW: Verify a specific fraud alert on-chain ────────────────────────────
exports.verifyOnChain = async (req, res) => {
  try {
    const { chainEventId } = req.params;
    const record = await blockchain.verifyRecord(chainEventId);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found on chain' });
    res.json({ success: true, record });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── 🔗 NEW: Get all chain event IDs for a user ────────────────────────────────
exports.getUserChainHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const ids = await blockchain.getUserEventIds(userId);
    res.json({ success: true, chainEventIds: ids });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};