# 🔐 SecureVault — AI-Powered Fraud Detection Banking System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-25%20passing-brightgreen)
![License](https://img.shields.io/badge/License-ISC-blue)

**A production-ready banking platform with real-time AI fraud detection, blockchain audit trails, and Redis-powered security.**

[API Docs](http://localhost:5000/api/docs) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [Features](#-features)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Fraud Detection** | Isolation Forest ML model scores every transaction in real-time |
| ⛓️ **Blockchain Audit Trail** | Every fraud action logged immutably to Ethereum Sepolia testnet |
| 🔴 **Redis Rate Limiting** | Brute-force protection: 5 login attempts per 15 min per IP |
| ⚡ **Dashboard Caching** | Bank/gateway stats cached in Redis (15–30s TTL) with auto-invalidation |
| 🔐 **Role-Based Access** | Three isolated portals: User, Gateway Admin, Bank Officer |
| 🌐 **Real-Time Alerts** | Socket.io with Redis adapter — fraud alerts broadcast across all instances |
| 🧪 **Test Suite** | 25 automated tests (Jest + Supertest) — auth, RBAC, validation |
| 🐳 **Fully Dockerized** | One command deploys the entire stack |
| 📖 **API Documentation** | Interactive Swagger UI at `/api/docs` |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│   React (User) │ React (Gateway Admin) │ React (Bank)       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                      BACKEND (Node.js)                      │
│                                                             │
│  Express API  ──►  Rate Limiter (Redis)                     │
│       │        ──►  Auth Middleware (Redis Cache)           │
│       │        ──►  Joi Validation                          │
│       ▼                                                     │
│  Security Engine ──► ML Service (FastAPI/Python)            │
│       │         ──► Blockchain Logger (Ethers.js)           │
│       ▼                                                     │
│  MongoDB Atlas + Redis + Socket.io (Redis Adapter)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Node.js 20** + Express 5 — API server
- **MongoDB Atlas** + Mongoose — Primary database
- **Redis 7** — Rate limiting, session caching, dashboard caching, Socket.io pub/sub
- **Socket.io** — Real-time fraud alerts (with Redis adapter for multi-instance)
- **Ethers.js** — Blockchain audit trail on Ethereum Sepolia
- **Winston** — Structured logging with file rotation
- **Joi** — Input validation and sanitization

### ML Service
- **Python 3.11** + FastAPI + Uvicorn
- **Isolation Forest** (scikit-learn) — Per-user anomaly detection model
- **Joblib** — Model persistence

### Frontend
- **React 18** + React Router — Three separate portals
- **Recharts** — Analytics dashboards
- **Socket.io Client** — Live fraud alert feeds

### DevOps
- **Docker** + Docker Compose — Full stack containerization
- **Multi-stage builds** — Minimal production images
- **Jest** + Supertest — API integration tests

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

> Runs the entire stack — backend, ML service, frontend, Redis — with one command.

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/securevault.git
cd securevault

# 2. Create environment file
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI and secrets

# 3. Start everything
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| API Docs | http://localhost:5000/api/docs |
| ML Service | http://localhost:8000 |

---

### Option 2: Local Development

**Prerequisites:** Node.js 20+, Python 3.11+, Docker (for Redis)

```bash
# 1. Start Redis
docker run -d --name securevault-redis -p 6379:6379 redis:7-alpine

# 2. Start ML Service
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Start Backend
cd backend
npm install
cp .env.example .env   # Fill in your values
npm run dev

# 4. Start Frontend
cd frontend
npm install
npm start
```

---

## ⚙️ Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret for signing JWTs | `your-secret-key` |
| `JWT_EXPIRE` | Token expiry | `7d` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `ML_SERVICE_URL` | ML service base URL | `http://localhost:8000` |
| `CLIENT_URL` | Frontend URL (CORS) | `http://localhost:3000` |
| `CONTRACT_ADDRESS` | Ethereum contract address | `0x...` |
| `RPC_URL` | Ethereum RPC endpoint | `https://sepolia.infura.io/...` |
| `METAMASK_PRIVATE_KEY` | Wallet private key for signing | `0x...` |

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

```
Test Suites: 3 passed, 3 total
Tests:       25 passed, 25 total

PASS tests/auth.test.js
  ✓ registers a new user successfully
  ✓ rejects duplicate email
  ✓ rejects missing name (Joi validation)
  ✓ strips injected role field (role injection blocked)
  ✓ logs in with correct credentials
  ✓ rejects wrong password

PASS tests/authorization.test.js
  ✓ rejects request to /api/transactions without token (401)
  ✓ regular user cannot access bank dashboard (403)
  ✓ user CAN access their own transactions (200)

PASS tests/validation.test.js
  ✓ rejects negative amount
  ✓ rejects amount over Rs.10,00,000
  ✓ rejects invalid UPI ID format
```

> Tests run against a separate `securevault_test` database — production data is never touched.

---

## 📁 Project Structure

```
securevault/
├── backend/
│   ├── src/
│   │   ├── config/         # Redis, DB, Swagger config
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # Auth, rate limiter, validator
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routers (with Swagger JSDoc)
│   │   ├── services/       # Security engine, ML, blockchain, fraud alerts
│   │   ├── utils/          # Logger, cache invalidation
│   │   └── validators/     # Joi schemas
│   ├── tests/              # Jest + Supertest test suites
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/          # User / Gateway / Bank portals
│   │   └── components/
│   └── Dockerfile
├── ml-service/
│   ├── main.py             # FastAPI app
│   ├── isolation_forest_model.py
│   └── Dockerfile
└── docker-compose.yml
```

---

## 🔒 Security Highlights

- **Role injection blocked** — `role` field stripped from all registration requests (Joi `stripUnknown`)
- **Brute force protection** — Redis-backed rate limiting persists across server restarts
- **Auth token caching** — User object cached in Redis for 5 min; cache busted on status change
- **Non-root Docker containers** — Backend runs as `securevault` system user
- **Secrets via env vars** — No credentials hardcoded anywhere in the codebase
- **Graceful shutdown** — SIGTERM/SIGINT handled cleanly; active requests drain before exit

---

## 📖 API Documentation

Interactive Swagger UI available at **[http://localhost:5000/api/docs](http://localhost:5000/api/docs)**

Key endpoints:

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Register new user |
| `POST` | `/api/auth/login` | ❌ | Login + get JWT |
| `GET` | `/api/transactions/my` | ✅ User | Get own transactions |
| `POST` | `/api/transactions` | ✅ User | Create transaction |
| `POST` | `/api/transactions/topup` | ✅ User | Top up balance |
| `GET` | `/api/gateway/dashboard` | ✅ Gateway Admin | Fraud monitoring stats |
| `PUT` | `/api/gateway/users/:id/suspend` | ✅ Gateway Admin | Suspend user |
| `GET` | `/api/bank/dashboard` | ✅ Bank Officer | Full analytics |
| `PUT` | `/api/bank/users/:id/approve` | ✅ Bank Officer | Clear fraud alert |
| `GET` | `/api/health` | ❌ | System health check |

---

## 📄 License

ISC © SecureVault Team
