/**
 * WebAR Restaurant Platform - Main Server
 * Production-ready server with comprehensive middleware and error handling
 */

require('dotenv').config();

// Set default JWT_SECRET if not provided (for development/initial setup)
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'webar-default-secret-change-in-production-' + Date.now();
    console.log('⚠️ WARNING: Using default JWT_SECRET. Set JWT_SECRET env var in production!');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Use DATA_DIR for cloud platforms (Render, Railway) or local directory
const DATA_DIR = process.env.DATA_DIR || __dirname;
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

console.log('📁 Data directory:', DATA_DIR);
console.log('📁 Uploads directory:', UPLOADS_DIR);

// Request ID Middleware
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
});

// Compression
app.use(compression({ level: 6 }));

// Morgan logging
morgan.token('id', (req) => req.id);
const morganFormat = isProduction
    ? ':id :remote-addr - :method :url :status :res[content-length] - :response-time ms'
    : 'dev';
app.use(morgan(morganFormat, { stream: logger.stream }));

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://aframe.io", "https://unpkg.com", "https://js.stripe.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            mediaSrc: ["'self'", "blob:", "data:"],
            connectSrc: ["'self'", "blob:", "data:", "https://api.stripe.com", "https://fonts.googleapis.com"],
            frameSrc: ["https://js.stripe.com"],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
    origin: isProduction ? process.env.CORS_ORIGINS?.split(',') : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    message: { success: false, error: 'Too many requests' },
    validate: { xForwardedForHeader: false }
});
app.use('/api/', limiter);

// Body parsing
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve from both local and DATA_DIR
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Ensure directories exist in DATA_DIR
['uploads', 'uploads/targets', 'uploads/content', 'uploads/compiled', 'uploads/qrcodes', 'data', 'logs'].forEach(dir => {
    const dirPath = path.join(DATA_DIR, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('📁 Created directory:', dirPath);
    }
});

// Also ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Swagger docs
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/branding', require('./routes/branding'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        status: 'healthy', 
        timestamp: new Date().toISOString(), 
        uptime: process.uptime(),
        dataDir: DATA_DIR,
        nodeEnv: process.env.NODE_ENV || 'development'
    });
});

// Public viewer endpoint
const { menuItemOps, analyticsOps } = require('./database');
app.get('/api/viewer/:id', (req, res) => {
    try {
        const item = menuItemOps.findById.get(req.params.id);
        if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
        if (!item.is_active) return res.status(403).json({ success: false, error: 'Item unavailable' });
        analyticsOps.trackView.run(item.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown');
        res.json({ success: true, data: { id: item.id, name: item.name, description: item.description, mindFile: item.mind_file, arContent: item.ar_content, contentType: item.content_type } });
    } catch (error) {
        console.error('Viewer error:', error);
        res.status(500).json({ success: false, error: 'Failed to load AR experience' });
    }
});

// SPA routes
['admin', 'viewer', 'login', 'signup', 'pricing', 'dashboard', 'reset-password'].forEach(page => {
    app.get(`/${page}`, (req, res) => {
        const filePath = path.join(__dirname, 'public', `${page}.html`);
        res.sendFile(fs.existsSync(filePath) ? filePath : path.join(__dirname, 'public', 'index.html'));
    });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Error handling
app.use((err, req, res, next) => {
    logger.logError(err, req);
    console.error('Server error:', err);
    res.status(err.status || 500).json({ success: false, error: isProduction ? 'Internal server error' : err.message });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' });
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
        logger.info(`${signal} received, shutting down...`);
        server.close(() => process.exit(0));
    });
});

module.exports = app;
