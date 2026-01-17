/**
 * Email Service
 */
const nodemailer = require('nodemailer');

const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

const FROM = process.env.EMAIL_FROM || 'WebAR Restaurant <noreply@webar.restaurant>';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const sendEmail = async (to, subject, html) => {
    if (!transporter) { console.log(`[Email] Would send to ${to}: ${subject}`); return { messageId: 'dev-mode' }; }
    return transporter.sendMail({ from: FROM, to, subject, html });
};

const sendVerificationEmail = async (email, token) => {
    const link = `${BASE_URL}/api/auth/verify/${token}`;
    return sendEmail(email, 'Verify your email - WebAR Restaurant', `<h1>Welcome!</h1><p>Please verify your email by clicking: <a href="${link}">${link}</a></p>`);
};

const sendPasswordResetEmail = async (email, token) => {
    const link = `${BASE_URL}/reset-password?token=${token}`;
    return sendEmail(email, 'Reset your password - WebAR Restaurant', `<h1>Password Reset</h1><p>Click to reset: <a href="${link}">${link}</a></p><p>Expires in 1 hour.</p>`);
};

const sendQRReadyEmail = async (email, itemName, viewerUrl, qrCodePath) => {
    return sendEmail(email, `Your AR QR Code is Ready - ${itemName}`, `<h1>AR Experience Ready!</h1><p>Your AR experience for "${itemName}" is live!</p><p><a href="${viewerUrl}">View AR Experience</a></p>`);
};

const sendWelcomeEmail = async (email, name) => {
    return sendEmail(email, 'Welcome to WebAR Restaurant!', `<h1>Welcome${name ? `, ${name}` : ''}!</h1><p>Start creating AR experiences at <a href="${BASE_URL}/admin">${BASE_URL}/admin</a></p>`);
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendQRReadyEmail, sendWelcomeEmail };