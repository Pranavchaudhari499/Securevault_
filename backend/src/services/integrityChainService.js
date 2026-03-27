const crypto = require('crypto');

const GENESIS_HASH = 'GENESIS_SECUREVAULT_V1';

function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).sort();
}

function buildPayload(tx, prevHash, sequence) {
  return {
    v: 1,
    sequence: Number(sequence),
    prevHash: String(prevHash || GENESIS_HASH),
    transactionId: String(tx.transactionId || ''),
    mongoId: String(tx._id || ''),
    userId: String(tx.userId || ''),
    recipientId: tx.recipientId ? String(tx.recipientId) : '',
    type: String(tx.type || ''),
    amount: Number(tx.amount || 0),
    status: String(tx.status || ''),
    gatewayDecision: String(tx.gatewayDecision || ''),
    bankDecision: String(tx.bankDecision || ''),
    riskScore: Number(tx.securityChecks?.overallRiskScore || 0),
    threatFlags: normalizeList(tx.threatFlags),
    createdAt: toIso(tx.createdAt),
    processedAt: toIso(tx.processedAt),
  };
}

function computeHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function verifyPayload(tx, integrity) {
  if (!integrity?.currentHash || !integrity?.prevHash || !integrity?.sequence) {
    return { valid: false, reason: 'Missing integrity fields' };
  }
  const payload = buildPayload(tx, integrity.prevHash, integrity.sequence);
  const computed = computeHash(payload);
  const valid = computed === integrity.currentHash;
  return {
    valid,
    expectedHash: computed,
    storedHash: integrity.currentHash,
    sequence: integrity.sequence,
  };
}

module.exports = {
  GENESIS_HASH,
  buildPayload,
  computeHash,
  verifyPayload,
};
