/**
 * Authentication Middleware
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { userOps } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES = '7d';

const hashPassword = async (password) => bcrypt.hash(password, 12);
const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
const generateToken = (user) => jwt.sign({ id: user.id, email: user.email, plan: user.plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;
        if (!token) return res.status(401).json({ error: 'Authentication required' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = userOps.findById.get(decoded.id);
        if (!user) return res.status(401).json({ error: 'User not found' });
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

const checkQRLimit = (req, res, next) => {
    const user = req.user;
    if (user.qr_codes_limit !== -1 && user.qr_codes_used >= user.qr_codes_limit) {
        return res.status(403).json({ error: 'QR code limit reached. Please upgrade your plan.' });
    }
    next();
};

module.exports = { hashPassword, comparePassword, generateToken, authenticate, generateVerificationToken, generateResetToken, checkQRLimit };