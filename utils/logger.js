/**
 * Winston Logger Configuration
 */
const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
require('fs').mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'webar-restaurant' },
    transports: [
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 5 }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log'), maxsize: 5242880, maxFiles: 5 })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }));
}

logger.stream = { write: (message) => logger.info(message.trim()) };
logger.logRequest = (req, res, duration) => logger.info('HTTP Request', { method: req.method, url: req.url, status: res.statusCode, duration, requestId: req.id });
logger.logError = (error, req) => logger.error(error.message, { stack: error.stack, requestId: req?.id, url: req?.url, method: req?.method });

module.exports = logger;