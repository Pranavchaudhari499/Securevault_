/**
 * tests/authorization.test.js
 * Tests that role-based access control works correctly.
 */

const request = require('supertest');
const { app } = require('../src/server');
const { connectTestDB, disconnectTestDB } = require('./setup');

let userToken = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectTestDB();

  // Register and login a regular user to get a token
  await request(app).post('/api/auth/register').send({
    name: 'Auth Test User',
    email: 'authtest@example.com',
    password: 'password123',
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'authtest@example.com',
    password: 'password123',
  });
  userToken = loginRes.body.token;
});

afterAll(async () => {
  await disconnectTestDB();
});

// ── Unauthenticated requests ────────────────────────────────────────────────────
describe('Unauthenticated access', () => {
  test('✓ rejects request to /api/transactions without token (401)', async () => {
    const res = await request(app).get('/api/transactions/my');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('✓ rejects request to /api/bank without token (401)', async () => {
    const res = await request(app).get('/api/bank/dashboard');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('✓ rejects request to /api/gateway without token (401)', async () => {
    const res = await request(app).get('/api/gateway/dashboard');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ── Role-based access ───────────────────────────────────────────────────────────
describe('Role-based access control', () => {
  test('✓ regular user cannot access bank dashboard (403)', async () => {
    const res = await request(app)
      .get('/api/bank/dashboard')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('✓ regular user cannot access gateway dashboard (403)', async () => {
    const res = await request(app)
      .get('/api/gateway/dashboard')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('✓ regular user cannot suspend another user (403)', async () => {
    const res = await request(app)
      .put('/api/gateway/users/000000000000000000000001/suspend')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'test' });
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('✓ user CAN access their own transactions (200 or 200 empty)', async () => {
    const res = await request(app)
      .get('/api/transactions/my')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
