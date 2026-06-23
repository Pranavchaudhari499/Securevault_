const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
	createTransaction,
	getMyTransactions,
	getAllTransactions,
	topUpBalance,
	getBalanceInstant,
	getIntegritySummary,
	verifyIntegrityTransaction,
	rebuildIntegrityChain,
} = require('../controllers/transactionController');
const { transactionLimiter, topUpLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { createTransactionSchema, topUpSchema } = require('../validators/transactionValidator');

router.post('/',    protect, authorize('user'), transactionLimiter, validate(createTransactionSchema), createTransaction);
router.get('/my',   protect, authorize('user'), getMyTransactions);
router.get('/balance', protect, authorize('user'), getBalanceInstant);
router.post('/topup', protect, authorize('user'), topUpLimiter, validate(topUpSchema), topUpBalance);
router.get('/all',  protect, authorize('gateway_admin', 'bank_officer'), getAllTransactions);
router.get('/integrity/summary', protect, authorize('user', 'gateway_admin', 'bank_officer'), getIntegritySummary);
router.get('/integrity/verify/:id', protect, authorize('user', 'gateway_admin', 'bank_officer'), verifyIntegrityTransaction);
router.post('/integrity/rebuild', protect, authorize('gateway_admin', 'bank_officer'), rebuildIntegrityChain);
module.exports = router;