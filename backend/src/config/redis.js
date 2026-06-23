const Redis = require('ioredis');
const logger = require('../utils/logger');

// ── Redis Client Singleton ─────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const REDIS_OPTIONS = {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      logger.error('[Redis] Max retries reached — giving up reconnection');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 500, 3000);
    logger.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  lazyConnect: false,
  enableReadyCheck: true,
  connectTimeout: 10000,
};

const redis = new Redis(REDIS_URL, REDIS_OPTIONS);

let isReady = false;

redis.on('connect', () => {
  logger.info(`[Redis] Connected to ${REDIS_URL}`);
});

redis.on('ready', () => {
  isReady = true;
  logger.info('[Redis] Ready to accept commands');
});

redis.on('error', (err) => {
  isReady = false;
  // Only log non-empty messages to reduce noise
  if (err.message) logger.error(`[Redis] Error: ${err.message}`);
});

redis.on('close', () => {
  isReady = false;
});

// ── Factory: create additional clients (for Socket.io adapter pub/sub) ──────────
function createClient() {
  const client = new Redis(REDIS_URL, REDIS_OPTIONS);
  // Attach error handler to prevent "Unhandled error event" crashes
  client.on('error', (err) => {
    if (err.message) logger.error(`[Redis:sub] Error: ${err.message}`);
  });
  return client;
}

// ── Health Check ────────────────────────────────────────────────────────────────
async function getRedisStatus() {
  if (!isReady) return { connected: false, reason: 'Not connected' };
  try {
    const ping = await redis.ping();
    const info = await redis.info('memory');
    const usedMemory = info.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'unknown';
    return { connected: true, ping, memoryUsed: usedMemory };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

// ── Graceful Shutdown Helper ────────────────────────────────────────────────────
async function quitRedis() {
  try {
    await redis.quit();
    logger.info('[Redis] Disconnected gracefully');
  } catch (err) {
    logger.error(`[Redis] Error during disconnect: ${err.message}`);
  }
}

module.exports = { redis, createClient, isReady: () => isReady, getRedisStatus, quitRedis };
