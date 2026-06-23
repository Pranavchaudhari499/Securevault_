const winston = require('winston');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

// ── Log directory ───────────────────────────────────────────────────────────────
const LOG_DIR = path.join(__dirname, '../../logs');

// ── Custom format for console (colorized, readable) ────────────────────────────
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
);

// ── JSON format for log files (structured, parseable) ──────────────────────────
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Transports ──────────────────────────────────────────────────────────────────
const transports = [
  new winston.transports.Console({ format: consoleFormat }),
];

// Add file transports in all environments
transports.push(
  // errors only — keep small, rotate at 5MB, keep 5 files
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5 * 1024 * 1024,  // 5MB
    maxFiles: 5,
    tailable: true,
  }),
  // all levels — rotate at 10MB, keep 5 files
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    format: fileFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  })
);

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  transports,
  // Don't exit on uncaught exceptions — let the shutdown handler deal with it
  exitOnError: false,
});

module.exports = logger;
