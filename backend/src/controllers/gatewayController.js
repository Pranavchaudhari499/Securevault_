const User = require('../models/User');
const Transaction = require('../models/Transaction');
const FraudAlert = require('../models/FraudAlert');
const { redis, isReady: isRedisReady } = require('../config/redis');
const { invalidateUserCache, invalidateDashboardCache } = require('../utils/cacheInvalidation');

function safeEmit(io, room, event, data) {
  try { if (io && typeof io.to === 'function') io.to(room).emit(event, data); } catch (e) {}
}

exports.getDashboardStats = async (req, res) => {
  try {
    const CACHE_KEY = 'cache:gateway:dashboard';

    // Serve from cache if available (15s TTL — shorter since live tx data changes fast)
    if (isRedisReady()) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json(JSON.parse(cached));
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const userScope = { role: 'user' };
    const blockedFilter = { role: 'user', $or: [{ status: 'blocked' }, { isSuspended: true }] };
    const [totalUsers, flaggedUsers, blockedUsers, openAlerts, todayTx] = await Promise.all([
      User.countDocuments(userScope),
      User.countDocuments({ ...userScope, status: 'flagged', isSuspended: { $ne: true } }),
      User.countDocuments(blockedFilter),
      FraudAlert.countDocuments({ status: { $in: ['pending', 'monitoring'] } }),
      Transaction.countDocuments({ createdAt: { $gte: today } })
    ]);
    const last7 = new Date(Date.now() - 7 * 86400000);
    const fraudTrend = await Transaction.aggregate([
      { $match: { createdAt: { $gte: last7 } } },
      { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, flagged: { $sum: { $cond: [{ $in: ['$status', ['flagged', 'blocked']] }, 1, 0] } }, total: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const recentAlerts = await FraudAlert.find({ status: { $ne: 'approved' } })
      .populate('userId', 'name email riskScore status')
      .sort({ updatedAt: -1 }).limit(8);
    const flaggedUsersList = await User.find({ status: 'flagged', role: 'user' })
      .select('name email riskScore flaggedActivityCount lastSuspiciousActivity velocity')
      .sort({ riskScore: -1 }).limit(10);
    const recentTransactions = await Transaction.find()
      .populate('userId', 'name email riskScore status')
      .sort({ createdAt: -1 }).limit(15);

    const result = { success: true, stats: { totalUsers, flaggedUsers, blockedUsers, openAlerts, todayTx }, fraudTrend, recentAlerts, flaggedUsersList, recentTransactions };

    // Cache for 15 seconds
    if (isRedisReady()) await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', 15);

    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ riskScore: -1 });
    res.json({ success: true, users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getLiveTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('userId', 'name email upiId riskScore status')
      .sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, transactions });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Suspend user (Gateway) ───────────────────────────────────────────────────
exports.suspendUser = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      {
        isSuspended: true,
        status: 'blocked',
        suspendedReason: reason.trim(),
        suspendedAt: new Date(),
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Create or update FraudAlert so bank sees this user in alerts
    const existingAlert = await FraudAlert.findOne({ userId: id });
    if (existingAlert) {
      await FraudAlert.findByIdAndUpdate(existingAlert._id, {
        status: 'auto_blocked',
        alertLevel: 'high',
        $push: {
          timeline: {
            timestamp: new Date(),
            event: 'Account suspended by Gateway officer',
            details: reason.trim(),
            fraudScore: existingAlert.fraudScore
          }
        }
      });
    } else {
      await FraudAlert.create({
        userId: id,
        fraudScore: user.riskScore || 60,
        fraudReason: reason.trim(),
        fraudReasons: [reason.trim()],
        alertLevel: 'high',
        suspiciousActivityCount: 1,
        status: 'auto_blocked',
        timeline: [{
          timestamp: new Date(),
          event: 'Account suspended by Gateway officer',
          details: reason.trim(),
          fraudScore: user.riskScore || 60
        }]
      });
    }

    // Notify the affected user
    safeEmit(io, `user-${id}`, 'account-blocked', {
      message: `Your account has been suspended. Reason: ${reason.trim()}`
    });

    // ✅ Notify bank — updates blockedUsers count and fraud alerts list
    safeEmit(io, 'bank-room', 'user-blocked', {
      user: { _id: id, name: user.name, email: user.email }
    });
    safeEmit(io, 'bank-room', 'fraud-alert-update', {
      userId: id, name: user.name, email: user.email
    });

    // Bust caches so dashboards reflect the suspension immediately
    await Promise.all([
      invalidateUserCache(id),
      invalidateDashboardCache('bank'),
      invalidateDashboardCache('gateway'),
    ]);

    res.json({ success: true, message: 'User suspended successfully', user });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── Unsuspend user (Gateway) ─────────────────────────────────────────────────
exports.unsuspendUser = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        isSuspended: false,
        status: 'active',
        suspendedReason: null,
        suspendedAt: null,
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Mark FraudAlert as approved so it leaves bank's pending list
    await FraudAlert.findOneAndUpdate(
      { userId: id },
      {
        status: 'approved',
        $push: {
          timeline: {
            timestamp: new Date(),
            event: 'Account reactivated by Gateway officer',
            details: 'Suspension lifted via gateway portal',
            fraudScore: 0
          }
        }
      }
    );

    // Notify the affected user
    safeEmit(io, `user-${id}`, 'notification', {
      message: 'Your account has been reactivated. You may transact normally.',
      type: 'info'
    });

    // ✅ Notify bank so their blockedUsers count decrements
    safeEmit(io, 'bank-room', 'user-approved', {
      user: { _id: id, name: user.name, email: user.email }
    });

    // ✅ Notify gateway room so other gateway sessions refresh their user list
    safeEmit(io, 'gateway-room', 'user-status-update', {
      userId: id, status: 'active'
    });

    // Bust caches
    await Promise.all([
      invalidateUserCache(id),
      invalidateDashboardCache('bank'),
      invalidateDashboardCache('gateway'),
    ]);

    res.json({ success: true, message: 'User reactivated successfully', user });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
