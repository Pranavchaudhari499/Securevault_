# SecureVault API Gateway

A security middleware layer between users and bank accounts with ML-powered fraud detection.

## Architecture
```
securevault/
├── frontend/      # React app - 3 portals
├── backend/       # Node.js + Express + MongoDB  
└── ml-service/    # Python FastAPI + Isolation Forest
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
