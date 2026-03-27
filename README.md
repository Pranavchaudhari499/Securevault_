# SecureVault API Gateway

A security middleware layer between users and bank accounts with ML-powered fraud detection.

## Architecture
```
securevault/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── bankController.js
│   │   │   ├── gatewayController.js
│   │   │   └── transactionController.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── models/
│   │   │   ├── FraudAlert.js
│   │   │   ├── Transaction.js
│   │   │   └── User.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── bank.js
│   │   │   ├── gateway.js
│   │   │   ├── transaction.js
│   │   │   └── user.js
│   │   ├── services/
│   │   │   ├── fraudAlertService.js
│   │   │   ├── mlService.js
│   │   │   └── securityEngine.js
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   └── seedData.js
│   │   └── server.js
│   ├── .env
│   ├── package-lock.json
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── shared/
│   │   │       └── Layout.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── pages/
│   │   │   ├── bank/
│   │   │   │   ├── Dashboard.js
│   │   │   │   ├── FraudAlerts.js
│   │   │   │   ├── NetworkGraph.js
│   │   │   │   └── Transactions.js
│   │   │   ├── gateway/
│   │   │   │   ├── Dashboard.js
│   │   │   │   ├── Transactions.js
│   │   │   │   └── Users.js
│   │   │   ├── user/
│   │   │   │   ├── Dashboard.js
│   │   │   │   ├── History.js
│   │   │   │   └── Payments.js
│   │   │   ├── LoginPage.js
│   │   │   └── RegisterPage.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── .env.example
│   │   ├── App.js
│   │   ├── index.css
│   │   └── index.js
│   ├── .env
│   ├── package-lock.json
│   └── package.json
├── ml-service/
│   ├── models/
│   │   └── saved/
│   │       ├── 69ac137ba7330a03c766825e.pkl
│   │       └── 69c4d0d547402b1e56434384.pkl
│   ├── isolation_forest_model.py
│   ├── main.py
│   └── requirements.txt
├── .gitignore
└── README.md
```

## Quick Start

### 1. ML Service
```bash
cd ml-service && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Backend
```bash
cd backend && npm install
cp .env.example .env  # fill in your MongoDB URI
npm run dev
```

### 3. Frontend
```bash
cd frontend && npm install && npm start
```

## Demo Credentials
| Portal | Email | Password |
|--------|-------|----------|
| User | user@demo.com | Demo@1234 |
| Gateway Admin | admin@vault.com | Admin@1234 |
| Bank Officer | officer@bank.com | Bank@1234 |
