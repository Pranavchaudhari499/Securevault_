/**
 * bank.js  (updated — blockchain routes added)
 * Place in: backend/routes/bank.js
 */

const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard, getFraudAlerts, approveUser, blockUser,
  increaseMonitoring, getHighRiskUsers, getNetworkGraph, unblockUser,
  // 🔗 New blockchain endpoints
  getBlockchainStatus, verifyOnChain, getUserChainHistory,
} = require('../controllers/bankController');

// Existing routes
router.get('/dashboard',          protect, authorize('bank_officer'), getDashboard);
router.get('/fraud-alerts',       protect, authorize('bank_officer'), getFraudAlerts);
router.get('/high-risk-users',    protect, authorize('bank_officer'), getHighRiskUsers);
router.get('/network-graph',      protect, authorize('bank_officer'), getNetworkGraph);
router.put('/users/:userId/approve',  protect, authorize('bank_officer'), approveUser);
router.put('/users/:userId/unblock',  protect, authorize('bank_officer'), unblockUser);
router.put('/users/:userId/block',    protect, authorize('bank_officer'), blockUser);
router.put('/users/:userId/monitor',  protect, authorize('bank_officer'), increaseMonitoring);

// 🔗 New blockchain routes
router.get('/blockchain/status',                  protect, authorize('bank_officer'), getBlockchainStatus);
router.get('/blockchain/status', protect, authorize('bank_officer', 'gateway_admin'), getBlockchainStatus);
router.get('/blockchain/verify/:chainEventId',    protect, authorize('bank_officer'), verifyOnChain);
router.get('/blockchain/user/:userId/history',    protect, authorize('bank_officer'), getUserChainHistory);

module.exports = router;