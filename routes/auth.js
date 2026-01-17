/**
 * Auth Routes
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { userOps } = require('../database');
const { hashPassword, comparePassword, generateToken, authenticate, generateVerificationToken, generateResetToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

router.post('/signup', async (req, res) => {
    try {
        const { email, password, businessName } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });
        if (userOps.findByEmail.get(email.toLowerCase())) return res.status(400).json({ error: 'Email exists' });
        const userId = uuidv4();
        const passwordHash = await hashPassword(password);
        const verificationToken = generateVerificationToken();
        userOps.create.run(userId, email.toLowerCase(), passwordHash, businessName || null, verificationToken);
        const user = userOps.findById.get(userId);
        sendVerificationEmail(email, verificationToken).catch(console.error);
        res.status(201).json({ success: true, message: 'Account created successfully! Please check your email to verify.', user: { id: user.id, email: user.email, businessName: user.business_name, plan: user.plan, qrCodesUsed: user.qr_codes_used, qrCodesLimit: user.qr_codes_limit, emailVerified: !!user.email_verified }, token: generateToken(user) });
    } catch (error) { console.error('Signup error:', error); res.status(500).json({ error: 'Failed to create account' }); }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = userOps.findByEmail.get(email.toLowerCase());
        if (!user || !(await comparePassword(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ success: true, user: { id: user.id, email: user.email, businessName: user.business_name, plan: user.plan, qrCodesUsed: user.qr_codes_used, qrCodesLimit: user.qr_codes_limit, emailVerified: !!user.email_verified, logoUrl: user.logo_url, brandColor: user.brand_color }, token: generateToken(user) });
    } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Login failed' }); }
});

router.post('/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true, message: 'Logged out' }); });

router.get('/me', authenticate, (req, res) => {
    const user = req.user;
    res.json({ id: user.id, email: user.email, businessName: user.business_name, plan: user.plan, qrCodesUsed: user.qr_codes_used, qrCodesLimit: user.qr_codes_limit, emailVerified: !!user.email_verified, logoUrl: user.logo_url, brandColor: user.brand_color, subscriptionStatus: user.subscription_status, createdAt: user.created_at });
});

router.put('/profile', authenticate, (req, res) => {
    try {
        const { businessName, brandColor } = req.body;
        userOps.updateProfile.run(businessName || req.user.business_name, req.body.logoUrl || req.user.logo_url, brandColor || req.user.brand_color, req.user.id);
        const updatedUser = userOps.findById.get(req.user.id);
        res.json({ success: true, user: { id: updatedUser.id, email: updatedUser.email, businessName: updatedUser.business_name, logoUrl: updatedUser.logo_url, brandColor: updatedUser.brand_color, plan: updatedUser.plan } });
    } catch (error) { console.error('Profile update error:', error); res.status(500).json({ error: 'Failed to update profile' }); }
});

router.get('/verify/:token', (req, res) => {
    try {
        const result = userOps.verifyEmail.run(req.params.token);
        if (result.changes === 0) return res.status(400).json({ error: 'Invalid verification token' });
        res.json({ success: true, message: 'Email verified!' });
    } catch (error) { res.status(500).json({ error: 'Verification failed' }); }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });
        const user = userOps.findByEmail.get(email.toLowerCase());
        if (user) {
            const resetToken = generateResetToken();
            userOps.setResetToken.run(resetToken, new Date(Date.now() + 3600000).toISOString(), email.toLowerCase());
            sendPasswordResetEmail(email, resetToken).catch(console.error);
        }
        res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (error) { res.status(500).json({ error: 'Request failed' }); }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });
        const user = userOps.findByResetToken.get(token);
        if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
        userOps.updatePassword.run(await hashPassword(password), user.id);
        res.json({ success: true, message: 'Password reset!' });
    } catch (error) { res.status(500).json({ error: 'Reset failed' }); }
});

module.exports = router;