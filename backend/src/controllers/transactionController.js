const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const securityEngine = require('../services/securityEngine');
const { upsertFraudAlert } = require('../services/fraudAlertService');
const mlService = require('../services/mlService');
const { GENESIS_HASH, buildPayload, computeHash, verifyPayload } = require('../services/integrityChainService');

function safeEmit(io, room, event, data) {
  try { if (io && typeof io.to === 'function') io.to(room).emit(event, data); } catch (e) {}
}

exports.createTransaction = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { type, amount, recipientUpi, recipientAccount, description, biometrics } = req.body;
    const userId = req.user.id;
    const parsedAmount = parseFloat(amount) || 0;
    const nonce = req.headers['x-request-nonce'] || uuidv4();
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown';
    const requestMeta = { ip: req.clientIp, userAgent, deviceFingerprint, nonce, timestamp: new Date() };

    // Check user status
    const userCheck = await User.findById(userId);
    if (!userCheck) return res.status(404).json({ success: false, message: 'User not found' });
    if (userCheck.status === 'blocked' || userCheck.isSuspended) {
      return res.status(403).json({ success: false, message: 'Your account is blocked. Please contact your bank.' });
    }

    // Balance check
    if (parsedAmount > 0 && type !== 'top_up') {
      if (userCheck.balance < parsedAmount) {
        return res.status(400).json({ success: false, message: `Insufficient balance. Available: Rs.${userCheck.balance.toLocaleString()}` });
      }
    }

    // Security analysis
    const { checks, threatFlags, riskScore, gatewayDecision, mlReasons, sessionData, velocitySnapshot } = await securityEngine.analyzeTransaction(
      userId, { type, amount: parsedAmount, recipientUpi }, requestMeta
    );

    // Biometrics
    const biometricData = biometrics ? {
      typingSpeed: biometrics.typingSpeed,
      sessionInteractionTime: biometrics.sessionTime,
      behaviorScore: biometrics.score || 0,
      anomaly: biometrics.anomaly || false
    } : {};

    if (biometrics?.anomaly) {
      mlReasons.push('Behavioral biometric anomaly detected during session');
      threatFlags.push('behavior_anomaly');
    }

    // Determine final status
    const isBlocked = gatewayDecision === 'block';
    const isFlagged = gatewayDecision === 'flag' && riskScore >= 25;
    // ✅ FIX: Only 'approved' transactions should deduct balance — not flagged
    const isApproved = !isBlocked && !isFlagged;
    const txStatus = isBlocked ? 'blocked' : isFlagged ? 'flagged' : 'approved';

    // Create transaction
    const transaction = new Transaction({
      transactionId: uuidv4(),
      userId, type, amount: parsedAmount,
      recipientUpi, recipientAccount, description,
      status: txStatus,
      gatewayDecision: gatewayDecision === 'flag' ? 'flag' : gatewayDecision,
      bankDecision: isBlocked ? 'rejected' : 'pending',
      securityChecks: { ...checks, mlReasons },
      sessionData: { ...sessionData, deviceId: deviceFingerprint, browser: userAgent.split('/')[0] },
      biometrics: biometricData,
      threatFlags,
      processedAt: new Date()
    });
    await transaction.save();

    // If suspicious — upsert fraud alert
    if (isFlagged || isBlocked) {
      await upsertFraudAlert({ userId, transactionId: transaction._id, fraudScore: riskScore, fraudReasons: mlReasons, sessionData, velocitySnapshot, io });
    }

    // ✅ FIX: Update risk score on ALL transactions (flagged too), not just blocked
    // This keeps user/gateway risk score in sync with what bank sees via fraudScore
    if (riskScore > 0) {
      await securityEngine.updateRiskScore(userId, Math.max(userCheck.riskScore, riskScore), mlReasons);
    }

    // ✅ FIX: Only deduct balance and update behavior profile for truly approved transactions
    if (isApproved) {
      if (parsedAmount > 0 && type !== 'top_up' && type !== 'balance_check') {
        await User.findByIdAndUpdate(userId, { $inc: { balance: -parsedAmount } });
      }
      // Update behavior profile (avg transaction amount etc.) only for approved
      await securityEngine.updateUserProfile(userId, { type, amount: parsedAmount, recipientUpi });
      await mlService.updateModel(
        userId,
        { amount: parsedAmount, hour: new Date().getHours(), dayOfWeek: new Date().getDay() },
        true
      );
    } else if (isFlagged) {
      // ✅ FIX: For flagged transactions, still update the behavior profile
      // so avg transaction amount reflects the attempt, but don't deduct balance
      await securityEngine.updateUserProfile(userId, { type, amount: parsedAmount, recipientUpi });
    }

    await securityEngine.updateIPHistory(userId, req.clientIp);
    await securityEngine.updateDeviceHistory(userId, deviceFingerprint, userAgent);

    const finalTx = await Transaction.findById(transaction._id);
    // ✅ FIX: Fetch fresh user with updated riskScore so response reflects real value
    const finalUser = await User.findById(userId).select('balance riskScore riskLevel status flaggedActivityCount');

    safeEmit(io, 'gateway-room', 'transaction-update', { transaction: finalTx, riskScore, gatewayDecision, threatFlags, mlReasons });

    res.json({
      success: true,
      transaction: finalTx,
      // ✅ Return the actual updated riskScore so UserDashboard shows correct value immediately
      userStatus: {
        balance: finalUser.balance,
        riskScore: finalUser.riskScore,
        riskLevel: finalUser.riskLevel,
        status: finalUser.status
      },
      securityAnalysis: { riskScore, gatewayDecision, threatFlags, checks, mlReasons }
    });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, transactions });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 30, status, userId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    const transactions = await Transaction.find(filter)
      .populate('userId', 'name email upiId riskScore status')
      .populate('recipientId', 'name email upiId')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Transaction.countDocuments(filter);
    res.json({ success: true, transactions, total, pages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.topUpBalance = async (req, res) => {
  try {
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || parsedAmount > 100000)
      return res.status(400).json({ success: false, message: 'Amount must be between Rs.1 and Rs.1,00,000' });
    const user = await User.findByIdAndUpdate(req.user.id, { $inc: { balance: parsedAmount } }, { new: true });
    const tx = new Transaction({
      transactionId: uuidv4(), userId: req.user.id, type: 'top_up', amount: parsedAmount,
      status: 'approved', gatewayDecision: 'allow', bankDecision: 'approved',
      description: 'Account top-up', processedAt: new Date(),
      securityChecks: { overallRiskScore: 0, mlDecision: 'normal' },
      sessionData: { ipAddress: req.clientIp }
    });
    await tx.save();
    res.json({ success: true, balance: user.balance, message: `Rs.${parsedAmount} added successfully` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getBalanceInstant = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('balance frozenBalance riskScore riskLevel status');
    res.json({ success: true, balance: user.balance, frozenBalance: user.frozenBalance || 0, status: user.status });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getIntegritySummary = async (req, res) => {
  try {
    const filter = req.user.role === 'user' ? { userId: req.user.id } : {};

    const [total, withIntegrity, latest] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.countDocuments({ ...filter, 'integrity.currentHash': { $ne: null } }),
      Transaction.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .select('transactionId status createdAt integrity')
        .lean(),
    ]);

    res.json({
      success: true,
      integrity: {
        total,
        withIntegrity,
        coverage: total > 0 ? Number(((withIntegrity / total) * 100).toFixed(2)) : 0,
        latestSequence: latest?.integrity?.sequence || 0,
        latestHash: latest?.integrity?.currentHash || null,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.verifyIntegrityTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
      .populate('userId', 'name email')
      .lean();

    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (req.user.role === 'user' && String(tx.userId?._id || tx.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const verification = verifyPayload(tx, tx.integrity);
    res.json({ success: true, verification, transaction: tx });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.rebuildIntegrityChain = async (req, res) => {
  try {
    const docs = await Transaction.find({})
      .sort({ createdAt: 1, _id: 1 })
      .select('_id transactionId userId recipientId type amount status gatewayDecision bankDecision securityChecks threatFlags createdAt processedAt integrity')
      .lean();

    if (!docs.length) {
      return res.json({ success: true, message: 'No transactions found', rebuilt: 0 });
    }

    let prevHash = GENESIS_HASH;
    let sequence = 0;
    const updates = [];

    for (const tx of docs) {
      sequence += 1;
      const payload = buildPayload(tx, prevHash, sequence);
      const currentHash = computeHash(payload);

      updates.push({
        updateOne: {
          filter: { _id: tx._id },
          update: {
            $set: {
              integrity: {
                sequence,
                prevHash,
                currentHash,
                algorithm: 'sha256',
                version: 'v1',
                verifiedAt: new Date(),
              },
            },
          },
        },
      });

      prevHash = currentHash;
    }

    if (updates.length) await Transaction.bulkWrite(updates, { ordered: true });

    res.json({ success: true, message: 'Integrity chain rebuilt', rebuilt: updates.length, latestSequence: sequence, latestHash: prevHash });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};