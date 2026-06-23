require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const { redis, createClient, getRedisStatus, quitRedis } = require('./config/redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', 1); // Trust one hop (direct reverse proxy/load balancer only)
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'] }
});

app.set('io', io);
connectDB();

// Socket.io Redis adapter — enables WebSocket events across multiple server instances
try {
  const pubClient = createClient();
  const subClient = createClient();
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('[Socket.io] Redis adapter configured — multi-instance ready');
} catch (err) {
  logger.warn(`[Socket.io] Redis adapter failed, using default adapter: ${err.message}`);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-nonce', 'x-device-fingerprint', 'x-client-ip']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use((req, res, next) => {
  // Priority: x-forwarded-for (reverse proxy) > x-client-ip (frontend public IP) > socket
  let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-client-ip']
    || req.ip
    || req.socket.remoteAddress
    || '127.0.0.1';

  // Normalize IPv6-mapped IPv4 (::ffff:192.168.1.1 -> 192.168.1.1)
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  // In local dev, socket gives 127.0.0.1 / ::1 — prefer frontend-reported public IP
  if ((ip === '127.0.0.1' || ip === '::1') && req.headers['x-client-ip']) {
    ip = req.headers['x-client-ip'];
  }

  req.clientIp = ip;
  next();
});

const { globalLimiter } = require('./middleware/rateLimiter');
app.use('/api/', globalLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/transactions', require('./routes/transaction'));
app.use('/api/gateway', require('./routes/gateway'));
app.use('/api/bank', require('./routes/bank'));

// ── Health Check (reports all service statuses) ────────────────────────────────
app.get('/api/health', async (req, res) => {
  const redisStatus = await getRedisStatus();
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const allHealthy = mongoStatus === 'connected' && redisStatus.connected;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    timestamp: new Date(),
    services: {
      mongodb: mongoStatus,
      redis: redisStatus,
    },
    memory: {
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)}MB`,
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`,
    },
  });
});

io.on('connection', (socket) => {
  socket.on('join-room', (room) => {
    socket.join(room);
    logger.info(`Socket joined room: ${room}`);
  });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const DEFAULT_PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_RETRIES = 10;

const startServer = (port, retriesLeft = MAX_PORT_RETRIES) => {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && process.env.NODE_ENV === 'development' && retriesLeft > 0) {
      const nextPort = port + 1;
      logger.warn(`Port ${port} is in use. Retrying on port ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, () => logger.info(`SecureVault running on port ${port}`));
};

// ── Graceful Shutdown ───────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => logger.info('HTTP server closed'));
  await mongoose.connection.close();
  logger.info('MongoDB disconnected');
  await quitRedis();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer(DEFAULT_PORT);
module.exports = { app, io };