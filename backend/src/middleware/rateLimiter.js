const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

// ── Custom Redis Store ──────────────────────────────────────────────────────────
// Avoids rate-limit-redis initialization timing issues by using ioredis directly.
// Redis is looked up lazily per-request — not at module load time.
// Falls back to in-memory Map if Redis is unavailable.
class IoRedisStore {
  constructor(prefix, windowMs) {
    this.prefix = `rl:${prefix}:`;
    this.windowSec = Math.ceil(windowMs / 1000);
    this.fallback = new Map();
  }

  _getRedis() {
    const { redis, isReady } = require('../config/redis');
    return isReady() ? redis : null;
  }

  async increment(key) {
    const fullKey = this.prefix + key;
    const client = this._getRedis();

    if (client) {
      try {
        const count = await client.incr(fullKey);
        if (count === 1) await client.expire(fullKey, this.windowSec);
        const ttl = await client.ttl(fullKey);
        return {
          totalHits: count,
          resetTime: new Date(Date.now() + ttl * 1000),
        };
      } catch (_) { /* fall through to in-memory */ }
    }

    // In-memory fallback
    const now = Date.now();
    const entry = this.fallback.get(fullKey) || { count: 0, resetAt: now + this.windowSec * 1000 };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + this.windowSec * 1000; }
    entry.count += 1;
    this.fallback.set(fullKey, entry);
    return { totalHits: entry.count, resetTime: new Date(entry.resetAt) };
  }

  async decrement(key) {
    const fullKey = this.prefix + key;
    const client = this._getRedis();
    if (client) {
      try { await client.decr(fullKey); return; } catch (_) {}
    }
    const entry = this.fallback.get(fullKey);
    if (entry && entry.count > 0) entry.count--;
  }

  async resetKey(key) {
    const fullKey = this.prefix + key;
    const client = this._getRedis();
    if (client) {
      try { await client.del(fullKey); return; } catch (_) {}
    }
    this.fallback.delete(fullKey);
  }
}

// ── Key Generators ──────────────────────────────────────────────────────────────
const makeIpKey = (req) => ipKeyGenerator(req.clientIp || req.ip);
const makeUserOrIpKey = (req) => {
  if (req.user?.id) return `user_${req.user.id}`;
  return ipKeyGenerator(req.clientIp || req.ip);
};

// ── Rate Limiters ───────────────────────────────────────────────────────────────

// Global: 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new IoRedisStore('global', 60 * 1000),
  message: { success: false, message: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/api/health',
  validate: { xForwardedForHeader: false },
});

// Login: 5 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new IoRedisStore('login', 15 * 60 * 1000),
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  keyGenerator: makeIpKey,
  validate: { xForwardedForHeader: false },
});

// Register: 3 accounts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: new IoRedisStore('register', 60 * 60 * 1000),
  message: { success: false, message: 'Too many accounts created. Please try again after 1 hour.' },
  keyGenerator: makeIpKey,
  validate: { xForwardedForHeader: false },
});

// Transactions: 10 per minute per user
const transactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new IoRedisStore('transaction', 60 * 1000),
  message: { success: false, message: 'Too many transactions. Maximum 10 per minute.' },
  keyGenerator: makeUserOrIpKey,
  validate: { xForwardedForHeader: false },
});

// Top-up: 5 per hour per user
const topUpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new IoRedisStore('topup', 60 * 60 * 1000),
  message: { success: false, message: 'Too many top-ups. Maximum 5 per hour.' },
  keyGenerator: makeUserOrIpKey,
  validate: { xForwardedForHeader: false },
});

module.exports = {
  globalLimiter,
  loginLimiter,
  registerLimiter,
  transactionLimiter,
  topUpLimiter,
};
