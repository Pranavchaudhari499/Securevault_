/**
 * tests/auth.test.js
 * Tests for POST /api/auth/register and POST /api/auth/login
 */

const request = require('supertest');
const { app } = require('../src/server');
const { connectTestDB, disconnectTestDB } = require('./setup');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

// ── Register ────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  const validUser = {
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'password123',
    phone: '9876543210',
  };

  test('✓ registers a new user successfully', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('user'); // Must always be 'user'
    expect(res.body.user.email).toBe(validUser.email);
  });

  test('✓ rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('✓ rejects missing name (Joi validation)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toEqual(expect.arrayContaining(['Name is required']));
  });

  test('✓ rejects invalid email format (Joi validation)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toEqual(expect.arrayContaining(['Please provide a valid email']));
  });

  test('✓ rejects short password (Joi validation)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test',
      email: 'test2@example.com',
      password: '123',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining(['Password must be at least 6 characters'])
    );
  });

  test('✓ strips injected role field (role injection blocked)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Hacker',
      email: 'hacker@example.com',
      password: 'password123',
      role: 'bank_officer', // Should be ignored
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe('user'); // Always 'user'
  });
});

// ── Login ───────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  test('✓ logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'testuser@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  test('✓ rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'testuser@example.com',
      password: 'wrongpassword',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('✓ rejects non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('✓ rejects missing email (Joi validation)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      password: 'password123',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});
