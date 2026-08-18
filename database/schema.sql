-- ===================================================
-- RDW RESTAURANT INVENTORY SYSTEM - SUPABASE POSTGRESQL SCHEMA
-- ===================================================

-- 0. CLEANUP OLD TABLES AND VIEWS IF EXISTING
DROP VIEW IF EXISTS v_low_stock CASCADE;
DROP VIEW IF EXISTS v_live_stock CASCADE;
DROP TABLE IF EXISTS stock_transactions CASCADE;
DROP TABLE IF EXISTS low_stock_alerts_log CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('IN', 'OUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stock_status AS ENUM ('OK', 'LOW STOCK', 'OUT OF STOCK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'staff',
    phone_number VARCHAR(20),
    notify_sms BOOLEAN DEFAULT TRUE,
    notify_email BOOLEAN DEFAULT TRUE,
    notify_push BOOLEAN DEFAULT TRUE,
    push_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCTS / ITEM MASTER TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE,
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    unit VARCHAR(50) NOT NULL DEFAULT 'Kg',
    opening_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    minimum_threshold NUMERIC(12, 2) NOT NULL DEFAULT 5.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. STOCK TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    change_type transaction_type NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    remark TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. SYSTEM SETTINGS TABLE (FOR COMPANY NOTIFICATIONS)
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    company_name VARCHAR(255) DEFAULT 'RDW Restaurant Inventory',
    company_email VARCHAR(255) DEFAULT 'inventory@rdwrestaurant.com',
    low_stock_email_alerts_enabled BOOLEAN DEFAULT TRUE,
    low_stock_sms_alerts_enabled BOOLEAN DEFAULT TRUE,
    low_stock_push_alerts_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if not existing
INSERT INTO system_settings (id, company_name, company_email)
VALUES (1, 'RDW Restaurant Inventory', 'inventory@rdwrestaurant.com')
ON CONFLICT (id) DO NOTHING;

-- 6. LOW STOCK NOTIFICATION AUDIT LOG
CREATE TABLE IF NOT EXISTS low_stock_alerts_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    current_stock NUMERIC(12, 2) NOT NULL,
    minimum_threshold NUMERIC(12, 2) NOT NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE,
    push_sent BOOLEAN DEFAULT FALSE,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 8. VIEWS
CREATE OR REPLACE VIEW v_live_stock AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.category,
    p.unit,
    p.opening_stock,
    COALESCE(SUM(CASE WHEN st.change_type = 'IN' THEN st.quantity ELSE 0 END), 0) AS total_stock_in,
    COALESCE(SUM(CASE WHEN st.change_type = 'OUT' THEN st.quantity ELSE 0 END), 0) AS total_stock_out,
    p.total_stock AS current_stock,
    p.minimum_threshold,
    CASE 
        WHEN p.total_stock <= 0 THEN 'OUT OF STOCK'::stock_status
        WHEN p.total_stock <= p.minimum_threshold THEN 'LOW STOCK'::stock_status
        ELSE 'OK'::stock_status
    END AS status,
    p.updated_at
FROM products p
LEFT JOIN stock_transactions st ON p.id = st.product_id
GROUP BY p.id;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT * FROM v_live_stock
WHERE current_stock <= minimum_threshold;

-- 9. TRIGGERS FOR AUTOMATED STOCK CALCULATION
CREATE OR REPLACE FUNCTION update_product_stock_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.change_type = 'IN') THEN
            UPDATE products 
            SET total_stock = total_stock + NEW.quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.product_id;
        ELSIF (NEW.change_type = 'OUT') THEN
            UPDATE products 
            SET total_stock = total_stock - NEW.quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock ON stock_transactions;
CREATE TRIGGER trg_update_stock
AFTER INSERT ON stock_transactions
FOR EACH ROW
EXECUTE FUNCTION update_product_stock_on_transaction();
