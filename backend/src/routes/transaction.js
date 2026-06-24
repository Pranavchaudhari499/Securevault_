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

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, amount]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [upi_payment, bank_transfer, bill_payment, withdrawal, top_up]
 *                 example: upi_payment
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 1000000
 *                 example: 1500
 *               recipientUpi:
 *                 type: string
 *                 example: merchant@securevault
 *                 description: Required for upi_payment type
 *               description:
 *                 type: string
 *                 example: Payment for groceries
 *     responses:
 *       200:
 *         description: Transaction processed (check status field — may be approved, flagged, or blocked by fraud engine)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 transaction: { $ref: '#/components/schemas/Transaction' }
 *                 gatewayDecision: { type: string, enum: [approved, flagged, blocked] }
 *                 riskScore: { type: number }
 *       400:
 *         description: Validation error or insufficient balance
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded (10 per minute)
 */
router.post('/', protect, authorize('user'), transactionLimiter, validate(createTransactionSchema), createTransaction);

/**
 * @swagger
 * /api/transactions/my:
 *   get:
 *     summary: Get current user's transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 transactions:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Transaction' }
 *       401:
 *         description: Unauthorized
 */
router.get('/my',   protect, authorize('user'), getMyTransactions);

/**
 * @swagger
 * /api/transactions/balance:
 *   get:
 *     summary: Get current user's live balance
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 balance: { type: number, example: 48500 }
 *       401:
 *         description: Unauthorized
 */
router.get('/balance', protect, authorize('user'), getBalanceInstant);

/**
 * @swagger
 * /api/transactions/topup:
 *   post:
 *     summary: Top up account balance
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100000
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Balance topped up
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       429:
 *         description: Rate limit exceeded (5 per hour)
 */
router.post('/topup', protect, authorize('user'), topUpLimiter, validate(topUpSchema), topUpBalance);

router.get('/all',  protect, authorize('gateway_admin', 'bank_officer'), getAllTransactions);
router.get('/integrity/summary', protect, authorize('user', 'gateway_admin', 'bank_officer'), getIntegritySummary);
router.get('/integrity/verify/:id', protect, authorize('user', 'gateway_admin', 'bank_officer'), verifyIntegrityTransaction);
router.post('/integrity/rebuild', protect, authorize('gateway_admin', 'bank_officer'), rebuildIntegrityChain);
module.exports = router;