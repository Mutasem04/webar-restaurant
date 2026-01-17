/**
 * Database Connection and Initialization
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'webar.db'));
db.pragma('foreign_keys = ON');

function initializeDatabase() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    schema.split(';').filter(s => s.trim()).forEach(stmt => {
        try { db.exec(stmt); } catch (e) { if (!e.message.includes('already exists')) console.error(e.message); }
    });
    console.log('✅ Database initialized');
}

initializeDatabase();

const userOps = {
    create: db.prepare('INSERT INTO users (id, email, password_hash, business_name, verification_token) VALUES (?, ?, ?, ?, ?)'),
    findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    findById: db.prepare('SELECT * FROM users WHERE id = ?'),
    updateProfile: db.prepare('UPDATE users SET business_name = ?, logo_url = ?, brand_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    updatePlan: db.prepare('UPDATE users SET plan = ?, qr_codes_limit = ?, stripe_subscription_id = ?, subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    updateStripeCustomer: db.prepare('UPDATE users SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    incrementQRCount: db.prepare('UPDATE users SET qr_codes_used = qr_codes_used + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    decrementQRCount: db.prepare('UPDATE users SET qr_codes_used = qr_codes_used - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND qr_codes_used > 0'),
    verifyEmail: db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE verification_token = ?'),
    setResetToken: db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?'),
    findByResetToken: db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > CURRENT_TIMESTAMP'),
    updatePassword: db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    updateBranding: db.prepare('UPDATE users SET branding_settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
};

const menuItemOps = {
    create: db.prepare('INSERT INTO menu_items (id, user_id, name, description, target_image, ar_content, content_type, mind_file, qr_code, viewer_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    findById: db.prepare('SELECT * FROM menu_items WHERE id = ?'),
    findByUser: db.prepare('SELECT * FROM menu_items WHERE user_id = ? ORDER BY created_at DESC'),
    findByIdAndUser: db.prepare('SELECT * FROM menu_items WHERE id = ? AND user_id = ?'),
    update: db.prepare('UPDATE menu_items SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
    delete: db.prepare('DELETE FROM menu_items WHERE id = ? AND user_id = ?'),
    toggleActive: db.prepare('UPDATE menu_items SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
    countByUser: db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE user_id = ?')
};

const analyticsOps = {
    create: db.prepare('INSERT INTO analytics (menu_item_id, user_id, event_type, device_type, browser, country, city, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    trackView: {
        run: (itemId, ip, ua) => {
            const item = menuItemOps.findById.get(itemId);
            if (item) db.prepare('INSERT INTO analytics (menu_item_id, user_id, event_type, ip_address, user_agent) VALUES (?, ?, "ar_view", ?, ?)').run(itemId, item.user_id, ip, ua);
        }
    },
    getByMenuItem: db.prepare('SELECT event_type, COUNT(*) as count, DATE(created_at) as date FROM analytics WHERE menu_item_id = ? GROUP BY event_type, DATE(created_at) ORDER BY date DESC LIMIT 100'),
    getByUser: db.prepare('SELECT event_type, COUNT(*) as count, DATE(created_at) as date FROM analytics WHERE user_id = ? GROUP BY event_type, DATE(created_at) ORDER BY date DESC LIMIT 100'),
    getSummaryByUser: db.prepare('SELECT event_type, COUNT(*) as total, COUNT(DISTINCT menu_item_id) as unique_items FROM analytics WHERE user_id = ? GROUP BY event_type'),
    getRecentByUser: db.prepare('SELECT a.*, m.name as item_name FROM analytics a JOIN menu_items m ON a.menu_item_id = m.id WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 50'),
    getTotalScans: db.prepare('SELECT COUNT(*) as total FROM analytics WHERE user_id = ? AND event_type = "qr_scan"'),
    getTotalViews: db.prepare('SELECT COUNT(*) as total FROM analytics WHERE user_id = ? AND event_type = "ar_view"')
};

const transactionOps = {
    create: db.prepare('INSERT INTO transactions (id, user_id, stripe_payment_id, amount, currency, status, description) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    findByUser: db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC'),
    updateStatus: db.prepare('UPDATE transactions SET status = ? WHERE stripe_payment_id = ?')
};

const planOps = {
    findAll: db.prepare('SELECT * FROM plans WHERE is_active = 1'),
    findById: db.prepare('SELECT * FROM plans WHERE id = ?')
};

module.exports = { db, userOps, menuItemOps, analyticsOps, transactionOps, planOps, initializeDatabase };