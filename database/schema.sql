-- WebAR Restaurant Platform Database Schema
-- SQLite Database

-- Users table (Restaurant owners)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    business_name TEXT,
    logo_url TEXT,
    brand_color TEXT DEFAULT '#00d9ff',
    branding_settings TEXT,
    plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'starter', 'pro', 'enterprise')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    qr_codes_used INTEGER DEFAULT 0,
    qr_codes_limit INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    email_verified INTEGER DEFAULT 0,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expires DATETIME
);

-- Menu items table
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_image TEXT NOT NULL,
    ar_content TEXT NOT NULL,
    content_type TEXT CHECK(content_type IN ('video', '3d', 'image')),
    mind_file TEXT,
    qr_code TEXT,
    viewer_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('qr_scan', 'ar_view', 'target_found', 'video_play')),
    device_type TEXT,
    browser TEXT,
    country TEXT,
    city TEXT,
    ip_address TEXT,
    user_agent TEXT,
    session_duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Payments/Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stripe_payment_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subscription plans reference
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    qr_limit INTEGER NOT NULL,
    features TEXT,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    is_active INTEGER DEFAULT 1
);

-- Insert default plans
INSERT OR IGNORE INTO plans (id, name, price_monthly, price_yearly, qr_limit, features) VALUES
('free', 'Free', 0, 0, 3, '["3 AR QR codes", "Basic analytics", "WebAR viewer", "Community support"]'),
('starter', 'Starter', 1900, 19000, 15, '["15 AR QR codes", "Full analytics", "Custom branding", "Email support", "HD QR downloads"]'),
('pro', 'Pro', 4900, 49000, 50, '["50 AR QR codes", "Priority support", "API access", "White-label viewer", "Team members (3)"]'),
('enterprise', 'Enterprise', 14900, 149000, -1, '["Unlimited QR codes", "Dedicated support", "Custom integrations", "SLA guarantee", "Unlimited team members"]');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_user ON menu_items(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_menu_item ON analytics(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);