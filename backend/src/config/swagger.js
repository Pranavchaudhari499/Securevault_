const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SecureVault API',
      version: '1.0.0',
      description: `
## 🔐 SecureVault — AI-Powered Fraud Detection Banking API

This API powers the SecureVault banking platform with real-time fraud detection, 
blockchain audit trails, and role-based access control across three portals:
- **User Portal** — Transactions, balance, notifications
- **Gateway Portal** — Real-time fraud monitoring, user suspension
- **Bank Portal** — Full fraud review, user approval/blocking, analytics

### Authentication
All protected endpoints require a **Bearer token** in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`
Obtain a token via \`POST /api/auth/login\`.

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| All API routes | 100 req/min |
| POST /api/auth/login | 5 attempts / 15 min |
| POST /api/auth/register | 3 accounts / hour |
| POST /api/transactions | 10 / min per user |
| POST /api/transactions/topup | 5 / hour per user |
      `,
      contact: { name: 'SecureVault Team' },
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Local Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error description' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: { type: 'string' },
              example: ['Name is required', 'Please provide a valid email'],
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f3b2c1e4b0a12345678901' },
            name: { type: 'string', example: 'Arjun Sharma' },
            email: { type: 'string', example: 'arjun@example.com' },
            role: { type: 'string', enum: ['user', 'gateway_admin', 'bank_officer'] },
            status: { type: 'string', enum: ['active', 'flagged', 'blocked'] },
            balance: { type: 'number', example: 50000 },
            riskScore: { type: 'number', example: 15 },
            riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            type: { type: 'string', enum: ['upi_payment', 'bank_transfer', 'bill_payment', 'withdrawal', 'top_up'] },
            amount: { type: 'number', example: 1500 },
            status: { type: 'string', enum: ['approved', 'flagged', 'blocked', 'rejected'] },
            recipientUpi: { type: 'string', example: 'merchant@securevault' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Register and login' },
      { name: 'User', description: 'User profile and notifications' },
      { name: 'Transactions', description: 'Create and view transactions' },
      { name: 'Gateway', description: 'Gateway admin — fraud monitoring' },
      { name: 'Bank', description: 'Bank officer — review and actions' },
      { name: 'Health', description: 'System health check' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
