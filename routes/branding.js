/**
 * Branding Routes
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { userOps } = require('../database');

router.get('/', authenticate, (req, res) => {
    try {
        const branding = req.user.branding_settings ? JSON.parse(req.user.branding_settings) : {};
        res.json({ success: true, branding: { logoUrl: req.user.logo_url, brandColor: req.user.brand_color, ...branding } });
    } catch (error) { res.status(500).json({ error: 'Failed to load branding' }); }
});

router.put('/', authenticate, (req, res) => {
    try {
        const { brandColor, customCSS, headerText, footerText } = req.body;
        if (brandColor) userOps.updateProfile.run(req.user.business_name, req.user.logo_url, brandColor, req.user.id);
        const brandingSettings = JSON.stringify({ customCSS, headerText, footerText });
        userOps.updateBranding.run(brandingSettings, req.user.id);
        res.json({ success: true, message: 'Branding updated' });
    } catch (error) { res.status(500).json({ error: 'Failed to update branding' }); }
});

module.exports = router;