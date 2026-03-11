const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getDashboardStats, getAllUsers, getLiveTransactions } = require('../controllers/gatewayController');
const { suspendUser, unsuspendUser } = require('../controllers/gatewayController');

router.put('/users/:id/suspend',   suspendUser);
router.put('/users/:id/unsuspend', unsuspendUser);
router.get('/dashboard', protect, authorize('gateway_admin'), getDashboardStats);
router.get('/users', protect, authorize('gateway_admin'), getAllUsers);
router.get('/transactions/live', protect, authorize('gateway_admin'), getLiveTransactions);
module.exports = router;