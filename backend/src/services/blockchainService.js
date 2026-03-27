/**
 * blockchainService.js
 * Place in: backend/services/blockchainService.js
 *
 * Wraps all ethers.js calls. Every write is fire-and-forget (non-blocking)
 * so it never slows down your API responses.
 *
 * Requires: npm install ethers
 * .env:  CONTRACT_ADDRESS, RPC_URL, METAMASK_PRIVATE_KEY
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');

// ── ABI (only the functions we call + events we read) ─────────────────────────
const ABI = [
  // Write
  'function logFraudEvent(string userId, string action, uint8 riskScore, string txHash, string reason) returns (uint256)',
  'function logUserAction(string userId, string action, string notes) returns (uint256)',
  // Read
  'function getRecord(uint256 eventId) view returns (tuple(uint256 eventId, string userId, string action, uint8 riskScore, string txHash, string reason, uint256 timestamp))',
  'function getUserEventIds(string userId) view returns (uint256[])',
  'function getEventCount() view returns (uint256)',
  // Events
  'event FraudEventLogged(uint256 indexed eventId, string indexed userId, string action, uint8 riskScore, string txHash, string reason, uint256 timestamp)',
  'event UserActionLogged(uint256 indexed eventId, string indexed userId, string action, address officer, string notes, uint256 timestamp)',
];

// ── Setup ─────────────────────────────────────────────────────────────────────
let provider, wallet, contract;
let isReady = false;

function init() {
  try {
    const { RPC_URL, METAMASK_PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;

    if (!RPC_URL || !METAMASK_PRIVATE_KEY || !CONTRACT_ADDRESS) {
      logger.warn('[Blockchain] Missing env vars — blockchain logging disabled. Add RPC_URL, METAMASK_PRIVATE_KEY, CONTRACT_ADDRESS to .env');
      return;
    }

    provider = new ethers.JsonRpcProvider(RPC_URL);
    wallet   = new ethers.Wallet(METAMASK_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
    isReady  = true;

    logger.info(`[Blockchain] Connected — wallet: ${wallet.address}`);
  } catch (err) {
    logger.error(`[Blockchain] Init failed: ${err.message}`);
  }
}

init(); // runs once on require()

// ── Helper: safe fire-and-forget wrapper ──────────────────────────────────────
/**
 * Wraps a contract write in a try/catch so the API never fails
 * even if Sepolia is slow or the wallet has no ETH.
 * Returns a Promise that resolves to { txHash, chainEventId } or null.
 */
async function safeWrite(label, contractCall) {
  if (!isReady) return null;
  try {
    const tx = await contractCall();
    const receipt = await tx.wait(1); // wait for 1 confirmation
    // The return value is emitted as an event; grab eventId from the first log
    const eventId = receipt.logs?.[0] ? 
      contract.interface.parseLog(receipt.logs[0])?.args?.eventId?.toString() 
      : null;
    logger.info(`[Blockchain] ${label} confirmed — txHash: ${receipt.hash} | eventId: ${eventId}`);
    return { txHash: receipt.hash, chainEventId: eventId };
  } catch (err) {
    logger.error(`[Blockchain] ${label} failed: ${err.message}`);
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Log a fraud/flag/block event from the transaction pipeline.
 *
 * @param {object} params
 * @param {string} params.userId        MongoDB User _id as string
 * @param {string} params.action        "flagged" | "blocked" | "auto_blocked" | "approved"
 * @param {number} params.riskScore     0–100
 * @param {string} params.mongoTxId     MongoDB Transaction or FraudAlert _id
 * @param {string} params.primaryReason First element of fraudReasons[]
 */
async function logFraudEvent({ userId, action, riskScore, mongoTxId, primaryReason }) {
  const safeScore = Math.min(255, Math.max(0, Math.round(riskScore)));
  const safeReason = (primaryReason || 'Suspicious activity').substring(0, 200);
  const safeTxId   = (mongoTxId || '').toString().substring(0, 66);

  return safeWrite(`logFraudEvent(${action}, score=${safeScore})`, () =>
    contract.logFraudEvent(userId.toString(), action, safeScore, safeTxId, safeReason)
  );
}

/**
 * Log a bank/gateway officer action.
 *
 * @param {object} params
 * @param {string} params.userId  MongoDB User _id as string
 * @param {string} params.action  "bank_approved" | "bank_blocked" | "bank_unblocked" | "gateway_suspended" | "gateway_unsuspended" | "bank_monitoring"
 * @param {string} params.notes   Officer notes
 */
async function logUserAction({ userId, action, notes }) {
  const safeNotes = (notes || '').substring(0, 200);
  return safeWrite(`logUserAction(${action})`, () =>
    contract.logUserAction(userId.toString(), action, safeNotes)
  );
}

/**
 * Verify a record on-chain given its chain event ID.
 * Used by the bank portal's "Verify on chain" button.
 *
 * @param {string|number} chainEventId
 * @returns {object|null} The on-chain record or null
 */
async function verifyRecord(chainEventId) {
  if (!isReady) return null;
  try {
    const rec = await contract.getRecord(BigInt(chainEventId));
    return {
      eventId:   rec.eventId.toString(),
      userId:    rec.userId,
      action:    rec.action,
      riskScore: Number(rec.riskScore),
      txHash:    rec.txHash,
      reason:    rec.reason,
      timestamp: new Date(Number(rec.timestamp) * 1000).toISOString(),
    };
  } catch (err) {
    logger.error(`[Blockchain] verifyRecord(${chainEventId}) failed: ${err.message}`);
    return null;
  }
}

/**
 * Get all event IDs for a user (for the bank portal timeline).
 * @param {string} userId
 */
async function getUserEventIds(userId) {
  if (!isReady) return [];
  try {
    const ids = await contract.getUserEventIds(userId.toString());
    return ids.map(id => id.toString());
  } catch (err) {
    logger.error(`[Blockchain] getUserEventIds failed: ${err.message}`);
    return [];
  }
}

/**
 * Get total events logged (health check).
 */
async function getEventCount() {
  if (!isReady) return null;
  try {
    const count = await contract.getEventCount();
    return count.toString();
  } catch (err) {
    return null;
  }
}

/**
 * Health check — returns wallet address + event count.
 */
async function getStatus() {
  if (!isReady) return { enabled: false, reason: 'Missing env vars' };
  try {
    const [balance, count] = await Promise.all([
      provider.getBalance(wallet.address),
      contract.getEventCount(),
    ]);
    return {
      enabled:       true,
      walletAddress: wallet.address,
      balanceETH:    ethers.formatEther(balance),
      totalEvents:   count.toString(),
      network:       'Sepolia',
    };
  } catch (err) {
    return { enabled: true, error: err.message };
  }
}

module.exports = {
  logFraudEvent,
  logUserAction,
  verifyRecord,
  getUserEventIds,
  getEventCount,
  getStatus,
};