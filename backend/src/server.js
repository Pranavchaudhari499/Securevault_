require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'] }
});

app.set('io', io);
connectDB();

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

  // DEBUG: Remove this log after confirming IP works
  if (req.path.includes('transaction')) {
    console.log('[IP DEBUG]', {
      finalIp: ip,
      xClientIp: req.headers['x-client-ip'] || 'NOT SENT',
      xForwardedFor: req.headers['x-forwarded-for'] || 'NOT SENT',
      socketIp: req.socket.remoteAddress,
      reqIp: req.ip,
      path: req.path
    });
  }

  req.clientIp = ip;
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/transactions', require('./routes/transaction'));
app.use('/api/gateway', require('./routes/gateway'));
app.use('/api/bank', require('./routes/bank'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

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

startServer(DEFAULT_PORT);
module.exports = { app, io };