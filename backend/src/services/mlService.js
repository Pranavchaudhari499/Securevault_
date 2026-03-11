const axios = require('axios');
const logger = require('../utils/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function analyzeAnomaly(userId, features) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/analyze`, {
      user_id: userId.toString(),
      features
    }, { timeout: 3000 });
    return response.data;
  } catch (error) {
    logger.warn(`ML service unavailable, using fallback scoring: ${error.message}`);
    // Fallback heuristic scoring
    let score = 0;
    if (features.ipChanged) score += 0.3;
    if (features.deviceChanged) score += 0.2;
    if (features.velocityScore > 0.5) score += 0.4;
    if (features.amount > features.userAvgAmount * 3) score += 0.3;
    return {
      anomalyScore: Math.min(1, score),
      decision: score > 0.6 ? 'anomaly' : 'normal',
      confidence: 0.6,
      source: 'fallback'
    };
  }
}

async function updateModel(userId, transactionFeatures, isLegitimate) {
  try {
    await axios.post(`${ML_SERVICE_URL}/update`, {
      user_id: userId.toString(),
      features: transactionFeatures,
      is_legitimate: isLegitimate
    }, { timeout: 5000 });
  } catch (error) {
    logger.warn(`ML model update failed: ${error.message}`);
  }
}

async function getUserThreshold(userId) {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/threshold/${userId}`, { timeout: 3000 });
    return response.data;
  } catch (error) {
    return { maxDailyTransactions: 10, maxTransactionAmount: 10000, adaptiveScore: 0.5 };
  }
}

module.exports = { analyzeAnomaly, updateModel, getUserThreshold };
