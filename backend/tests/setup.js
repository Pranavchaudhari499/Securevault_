/**
 * tests/setup.js
 * Shared test utilities: app instance, DB connection, cleanup helpers.
 * Uses your real Atlas DB with a dedicated test database (securevault_test).
 */

const mongoose = require('mongoose');

// Point to a separate test DB so tests never touch production data
const TEST_DB_URI = (process.env.MONGODB_URI || 'mongodb://localhost:27017/securevault')
  .replace(/\/securevault(\?|$)/, '/securevault_test$1');

// Connect once before all tests in a suite
async function connectTestDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
}

// Drop the test DB after all tests in a suite
async function disconnectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
}

// Clear a specific collection between tests
async function clearCollection(modelName) {
  const Model = mongoose.model(modelName);
  await Model.deleteMany({});
}

module.exports = { connectTestDB, disconnectTestDB, clearCollection, TEST_DB_URI };
