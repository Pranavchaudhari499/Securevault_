const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard, getFraudAlerts, approveUser, blockUser,
  increaseMonitoring, getHighRiskUsers, getNetworkGraph, unblockUser
} = require('../controllers/bankController');

router.get('/dashboard',          protect, authorize('bank_officer'), getDashboard);
router.get('/fraud-alerts',       protect, authorize('bank_officer'), getFraudAlerts);
router.get('/high-risk-users',    protect, authorize('bank_officer'), getHighRiskUsers);
router.get('/network-graph',      protect, authorize('bank_officer'), getNetworkGraph);
router.put('/users/:userId/approve',  protect, authorize('bank_officer'), approveUser);
router.put('/users/:userId/unblock',  protect, authorize('bank_officer'), unblockUser);
router.put('/users/:userId/block',    protect, authorize('bank_officer'), blockUser);
router.put('/users/:userId/monitor',  protect, authorize('bank_officer'), increaseMonitoring);

module.exports = router;