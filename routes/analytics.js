/**
 * Analytics Routes
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { analyticsOps, menuItemOps } = require('../database');

router.get('/summary', authenticate, (req, res) => {
    try {
        const summary = analyticsOps.getSummaryByUser.all(req.user.id);
        const items = menuItemOps.findByUser.all(req.user.id);
        const scans = analyticsOps.getTotalScans.get(req.user.id)?.total || 0;
        const views = analyticsOps.getTotalViews.get(req.user.id)?.total || 0;
        res.json({ success: true, summary: { totalItems: items.length, totalScans: scans, totalViews: views, byEventType: summary } });
    } catch (error) { console.error('Analytics error:', error); res.status(500).json({ error: 'Failed to load analytics' }); }
});

router.get('/recent', authenticate, (req, res) => {
    try {
        const recent = analyticsOps.getRecentByUser.all(req.user.id);
        res.json({ success: true, data: recent });
    } catch (error) { res.status(500).json({ error: 'Failed to load recent analytics' }); }
});

router.get('/item/:id', authenticate, (req, res) => {
    try {
        const item = menuItemOps.findByIdAndUser.get(req.params.id, req.user.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        const analytics = analyticsOps.getByMenuItem.all(req.params.id);
        res.json({ success: true, item: { id: item.id, name: item.name }, analytics });
    } catch (error) { res.status(500).json({ error: 'Failed to load item analytics' }); }
});

router.get('/export', authenticate, (req, res) => {
    try {
        const format = req.query.format || 'json';
        const data = analyticsOps.getRecentByUser.all(req.user.id);
        if (format === 'csv') {
            const { Parser } = require('json2csv');
            const parser = new Parser({ fields: ['event_type', 'item_name', 'ip_address', 'user_agent', 'created_at'] });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
            res.send(parser.parse(data));
        } else {
            res.json({ success: true, data });
        }
    } catch (error) { res.status(500).json({ error: 'Export failed' }); }
});

module.exports = router;