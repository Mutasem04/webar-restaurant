/**
 * Menu Items Routes
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const router = express.Router();
const { authenticate, checkQRLimit } = require('../middleware/auth');
const { menuItemOps, userOps } = require('../database');
const { compileTargetImage, validateTargetImage } = require('../services/compiler');
const { sendQRReadyEmail } = require('../services/email');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Use DATA_DIR for cloud platforms (Render, Railway) or local directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

console.log('📁 Items route - Uploads directory:', UPLOADS_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subDir = file.fieldname === 'targetImage' ? 'targets' : 'content';
        const dir = path.join(UPLOADS_DIR, subDir);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'targetImage') {
        cb(null, file.mimetype.startsWith('image/'));
    } else if (file.fieldname === 'arContent') {
        const allowed = ['video/mp4', 'video/webm', 'model/gltf-binary', 'application/octet-stream', 'image/jpeg', 'image/png'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(file.mimetype) || ['.mp4', '.webm', '.glb', '.gltf', '.jpg', '.jpeg', '.png'].includes(ext));
    } else cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });

router.get('/', authenticate, (req, res) => {
    try {
        const items = menuItemOps.findByUser.all(req.user.id);
        res.json({ success: true, items: items.map(i => ({ id: i.id, name: i.name, description: i.description, targetImage: i.target_image, arContent: i.ar_content, contentType: i.content_type, mindFile: i.mind_file, qrCode: i.qr_code, viewerUrl: i.viewer_url, isActive: !!i.is_active, createdAt: i.created_at })) });
    } catch (error) { res.status(500).json({ error: 'Failed to list items' }); }
});

router.get('/:id', (req, res) => {
    try {
        const item = menuItemOps.findById.get(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json({ id: item.id, name: item.name, description: item.description, targetImage: item.target_image, arContent: item.ar_content, contentType: item.content_type, mindFile: item.mind_file, viewerUrl: item.viewer_url, isActive: !!item.is_active });
    } catch (error) { res.status(500).json({ error: 'Failed to get item' }); }
});

router.post('/', authenticate, checkQRLimit, upload.fields([{ name: 'targetImage', maxCount: 1 }, { name: 'arContent', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!req.files?.targetImage || !req.files?.arContent) return res.status(400).json({ error: 'Both target image and AR content are required' });
        const targetFile = req.files.targetImage[0];
        const contentFile = req.files.arContent[0];
        const validation = validateTargetImage(targetFile.path);
        if (!validation.valid) { fs.unlinkSync(targetFile.path); fs.unlinkSync(contentFile.path); return res.status(400).json({ error: validation.error }); }
        const contentExt = path.extname(contentFile.filename).toLowerCase();
        const contentType = ['.glb', '.gltf'].includes(contentExt) ? '3d' : ['.jpg', '.jpeg', '.png'].includes(contentExt) ? 'image' : 'video';
        const itemId = uuidv4();
        const mindFilePath = path.join(UPLOADS_DIR, 'compiled', `${itemId}.mind`);
        const qrCodePath = path.join(UPLOADS_DIR, 'qrcodes', `${itemId}.png`);
        
        // Ensure directories exist
        fs.mkdirSync(path.dirname(mindFilePath), { recursive: true });
        fs.mkdirSync(path.dirname(qrCodePath), { recursive: true });
        
        await compileTargetImage(targetFile.path, mindFilePath);
        const viewerUrl = `${BASE_URL}/viewer.html?id=${itemId}`;
        await QRCode.toFile(qrCodePath, viewerUrl, { width: 400, margin: 2 });
        menuItemOps.create.run(itemId, req.user.id, name || 'Unnamed Item', description || '', `/uploads/targets/${targetFile.filename}`, `/uploads/content/${contentFile.filename}`, contentType, `/uploads/compiled/${itemId}.mind`, `/uploads/qrcodes/${itemId}.png`, viewerUrl);
        userOps.incrementQRCount.run(req.user.id);
        const item = menuItemOps.findById.get(itemId);
        sendQRReadyEmail(req.user.email, item.name, viewerUrl, item.qr_code).catch(console.error);
        res.status(201).json({ success: true, message: 'Menu item created!', item: { id: item.id, name: item.name, description: item.description, targetImage: item.target_image, arContent: item.ar_content, contentType: item.content_type, mindFile: item.mind_file, qrCode: item.qr_code, viewerUrl: item.viewer_url, createdAt: item.created_at } });
    } catch (error) { console.error('Create item error:', error); res.status(500).json({ error: error.message }); }
});

router.put('/:id', authenticate, (req, res) => {
    try {
        const { name, description } = req.body;
        const existing = menuItemOps.findByIdAndUser.get(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: 'Item not found' });
        menuItemOps.update.run(name || existing.name, description ?? existing.description, req.params.id, req.user.id);
        const updated = menuItemOps.findById.get(req.params.id);
        res.json({ success: true, item: { id: updated.id, name: updated.name, description: updated.description } });
    } catch (error) { res.status(500).json({ error: 'Failed to update item' }); }
});

router.delete('/:id', authenticate, (req, res) => {
    try {
        const item = menuItemOps.findByIdAndUser.get(req.params.id, req.user.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        
        // Clean up files (use DATA_DIR for cloud compatibility)
        const filesToDelete = [
            item.target_image,
            item.ar_content,
            item.mind_file,
            item.qr_code
        ].filter(Boolean);
        
        for (const filePath of filesToDelete) {
            const fullPath = path.join(DATA_DIR, filePath);
            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (e) {
                    console.error('Failed to delete file:', fullPath, e);
                }
            }
        }
        
        menuItemOps.delete.run(req.params.id, req.user.id);
        userOps.decrementQRCount.run(req.user.id);
        res.json({ success: true, message: 'Item deleted' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete item' }); }
});

router.patch('/:id/toggle', authenticate, (req, res) => {
    try {
        const item = menuItemOps.findByIdAndUser.get(req.params.id, req.user.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        menuItemOps.toggleActive.run(req.params.id, req.user.id);
        const updated = menuItemOps.findById.get(req.params.id);
        res.json({ success: true, isActive: !!updated.is_active });
    } catch (error) { res.status(500).json({ error: 'Failed to toggle item' }); }
});

module.exports = router;
