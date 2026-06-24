// CJS-compatible uuid shim for Jest
// uuid v13 is ESM-only, but Node 14.17+ has crypto.randomUUID() built-in
const { randomUUID } = require('crypto');

module.exports = {
  v4: randomUUID,
  v1: randomUUID,
};
