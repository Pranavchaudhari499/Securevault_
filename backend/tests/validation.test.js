/**
 * tests/validation.test.js
 * Tests that Joi validation correctly rejects bad transaction inputs.
 */

const request = require('supertest');
const { app } = require('../src/server');
const { connectTestDB, disconnectTestDB } = require('./setup');

let token = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectTestDB();

  // Register + login user
  await request(app).post('/api/auth/register').send({
    name: 'Validation Tester',
    email: 'validator@example.com',
    password: 'password123',
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'validator@example.com',
    password: 'password123',
  });
  token = loginRes.body.token;
});

afterAll(async () => {
  await disconnectTestDB();
});

// ── Transaction Validation ──────────────────────────────────────────────────────
describe('Transaction input validation', () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  test('✓ rejects missing amount', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'upi_payment', recipientUpi: 'someone@securevault' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toEqual(expect.arrayContaining(['Amount is required']));
  });

  test('✓ rejects negative amount', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'upi_payment', amount: -500, recipientUpi: 'someone@securevault' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('✓ rejects amount over Rs.10,00,000', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'upi_payment', amount: 9999999, recipientUpi: 'someone@securevault' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('✓ rejects invalid transaction type', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'crypto_transfer', amount: 100 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('✓ rejects UPI payment without recipientUpi', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'upi_payment', amount: 100 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('✓ rejects invalid UPI ID format', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'upi_payment', amount: 100, recipientUpi: 'not a valid upi' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});

// ── Top-Up Validation ───────────────────────────────────────────────────────────
describe('Top-up input validation', () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  test('✓ rejects top-up with no amount', async () => {
    const res = await request(app)
      .post('/api/transactions/topup')
      .set(auth())
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('✓ rejects top-up over Rs.1,00,000', async () => {
    const res = await request(app)
      .post('/api/transactions/topup')
      .set(auth())
      .send({ amount: 200000 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});
