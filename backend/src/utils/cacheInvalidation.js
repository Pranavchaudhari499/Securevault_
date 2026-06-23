const { redis, isReady } = require('../config/redis');
const logger = require('./logger');

async function invalidateUserCache(userId) {
  if (!isReady() || !userId) return;
  try {
    await redis.del(`user:session:${userId}`);
    logger.info(`[Cache] Invalidated user session cache for ${userId}`);
  } catch (err) {
    logger.error(`[Cache] Failed to invalidate user ${userId}: ${err.message}`);
  }
}

async function invalidateDashboardCache(role) {
  if (!isReady()) return;
  try {
    const key = `cache:${role}:dashboard`;
    await redis.del(key);
    logger.info(`[Cache] Invalidated ${role} dashboard cache`);
  } catch (err) {
    logger.error(`[Cache] Failed to invalidate ${role} dashboard: ${err.message}`);
  }
}

module.exports = {
  invalidateUserCache,
  invalidateDashboardCache
};
