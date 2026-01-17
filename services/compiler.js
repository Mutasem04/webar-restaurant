/**
 * MindAR Compiler Service
 */
const fs = require('fs');
const path = require('path');

const validateTargetImage = (imagePath) => {
    try {
        if (!fs.existsSync(imagePath)) return { valid: false, error: 'Image file not found' };
        const stats = fs.statSync(imagePath);
        if (stats.size < 1000) return { valid: false, error: 'Image too small' };
        if (stats.size > 10 * 1024 * 1024) return { valid: false, error: 'Image too large (max 10MB)' };
        const ext = path.extname(imagePath).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return { valid: false, error: 'Invalid image format' };
        return { valid: true };
    } catch (error) { return { valid: false, error: error.message }; }
};

const compileTargetImage = async (inputPath, outputPath) => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // MindAR compilation happens client-side via CDN
    // This creates a placeholder .mind file
    const mindData = { version: 1, inputImage: path.basename(inputPath), createdAt: new Date().toISOString(), targetImage: `/uploads/targets/${path.basename(inputPath)}` };
    fs.writeFileSync(outputPath, JSON.stringify(mindData));
    return outputPath;
};

module.exports = { validateTargetImage, compileTargetImage };