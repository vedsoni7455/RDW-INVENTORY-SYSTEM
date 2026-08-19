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
-- ===================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- ===================================================

-- Enable RLS on core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE low_stock_alerts_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is Owner or Manager
CREATE OR REPLACE FUNCTION is_owner_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('owner', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. USERS POLICIES
-- Everyone authenticated can view user profiles
CREATE POLICY "Users are viewable by authenticated users" 
ON users FOR SELECT 
TO authenticated 
USING (true);

-- Only Owners and Managers can insert or modify users/roles
CREATE POLICY "Owners and Managers can manage users" 
ON users FOR ALL 
TO authenticated 
USING (is_owner_or_manager());

-- 2. PRODUCTS POLICIES
-- All roles (Owner, Manager, Staff) can view products
CREATE POLICY "Products are viewable by all authenticated users" 
ON products FOR SELECT 
TO authenticated 
USING (true);

-- Only Owners and Managers can create, update, or delete products
CREATE POLICY "Owners and Managers can create products" 
ON products FOR INSERT 
TO authenticated 
WITH CHECK (is_owner_or_manager());

CREATE POLICY "Owners and Managers can update products" 
ON products FOR UPDATE 
TO authenticated 
USING (is_owner_or_manager());

CREATE POLICY "Owners and Managers can delete products" 
ON products FOR DELETE 
TO authenticated 
USING (is_owner_or_manager());

-- 3. STOCK TRANSACTIONS POLICIES
-- All roles can view transaction history
CREATE POLICY "Transactions viewable by all authenticated users" 
ON stock_transactions FOR SELECT 
TO authenticated 
USING (true);

-- All authenticated roles (including Staff) can insert Stock In / Stock Out transactions
CREATE POLICY "All authenticated users can log transactions" 
ON stock_transactions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL OR created_by IS NOT NULL);

-- Only Owners and Managers can edit or delete historical transactions
CREATE POLICY "Owners and Managers can delete transactions" 
ON stock_transactions FOR DELETE 
TO authenticated 
USING (is_owner_or_manager());

-- 4. PUBLISH REALTIME CHANNELS
-- Enable Supabase Realtime tracking on products and stock_transactions
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE products, stock_transactions;
COMMIT;
-- SEED DATA FROM EXCEL FILES

INSERT INTO users (id, email, name, role, phone_number) VALUES 
('11111111-1111-1111-1111-111111111111', 'owner@rdwrestaurant.com', 'Restaurant Owner', 'owner', '+919876543210'),
('22222222-2222-2222-2222-222222222222', 'manager@rdwrestaurant.com', 'Store Manager', 'manager', '+919876543211'),
('33333333-3333-3333-3333-333333333333', 'kitchen@rdwrestaurant.com', 'Kitchen Staff', 'staff', '+919876543212')
ON CONFLICT (email) DO NOTHING;

INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'SKU-0001', 'Red Chilli Sauce 750 ML', 'Sauce', 'Bottle', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a2857b5e-f69e-4a1f-801e-6b84e857e0fd', 'SKU-0002', 'Green Chilli Sauce 750 ML', 'Sauce', 'Bottle', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('634efd95-9268-4388-a5e5-51dc55739395', 'SKU-0003', 'Soy Sauce 750 ML', 'Sauce', 'Bottle', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('1d3cf599-f477-4928-8af2-52fce94a7e11', 'SKU-0004', 'Vinegar 750 ML', 'Sauce', 'Bottle', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('677b5edd-490c-4a59-ae54-4d3a2297078b', 'SKU-0005', 'Red Chilli Sauce 5 Ltr', 'Sauce', 'Can', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('5e7e0c47-7187-4772-8eb2-44ce0549ee85', 'SKU-0006', 'Green Chilli Sauce 5 Ltr', 'Sauce', 'Can', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('caac0119-4eac-4a31-996f-b62c478f905d', 'SKU-0007', 'Tomato Sauce 5 Ltr', 'Sauce', 'Can', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('aac7e39f-f0a1-4ae3-bd00-ac919d002cf8', 'SKU-0008', 'Schezwan Sauce', 'Sauce', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b56cc18f-9d8a-4a19-865b-2b6243d8ef40', 'SKU-0009', 'Tandoori Mayo', 'Sauce', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a16e3fc2-b96d-4122-992c-28e5f13add61', 'SKU-0010', 'Chilli Garlic Sauce', 'Sauce', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('bd013d23-2343-4b5e-a5b3-29424d570433', 'SKU-0011', 'Rice', 'Grocery', 'Kg', 0.0, 0.0, 25.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('8a85d122-94f6-4c1e-9fb0-229f30758ab3', 'SKU-0012', 'Urad Dal', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'SKU-0013', 'Toor Dal', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('7d9eafff-6b2f-4f4f-af6e-67c6110ab20f', 'SKU-0014', 'Chana Dal', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('34e09e63-7d1e-463e-be22-8ff3a6af2200', 'SKU-0015', 'Moong Dal', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('ce1cf8db-3c6b-405d-81ee-cb7b91073b26', 'SKU-0016', 'Sugar', 'Grocery', 'Kg', 0.0, 0.0, 25.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('2d4ff984-4103-41d5-b660-9988fab279cd', 'SKU-0017', 'Salt', 'Grocery', 'Kg', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('f4ad9b2e-d1b1-47dd-9687-2ec29600fbb3', 'SKU-0018', 'Jaggery', 'Grocery', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('6d3c04ca-e759-4fac-acc4-29ede8f11451', 'SKU-0019', 'Rava', 'Grocery', 'Kg', 0.0, 0.0, 25.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('aa78a9a9-dae0-4057-b6ef-85317a3494cf', 'SKU-0020', 'Maida', 'Grocery', 'Kg', 0.0, 0.0, 25.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c263931d-7d0a-47ab-ae43-5c089e8d6f3d', 'SKU-0021', 'Corn Flour', 'Grocery', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('5ce78c02-5346-4080-bc30-d8e1e10986ec', 'SKU-0022', 'Rice Flour', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('3132b349-a461-427d-a704-2a0c3369b872', 'SKU-0023', 'Besan', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a6b92795-0a9a-4972-8790-ef4e69fe759b', 'SKU-0024', 'Tamarind', 'Grocery', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c0c9476f-5087-41f1-9701-4742a227c5d6', 'SKU-0025', 'Groundnut Oil', 'Grocery', 'Ltr', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('f30c28a5-0951-4a57-b296-9436dc3619e8', 'SKU-0026', 'Sunflower Oil', 'Grocery', 'Ltr', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('afde402c-c08f-4a6a-b93b-5d538ff7991b', 'SKU-0027', 'Ghee', 'Grocery', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('60f719bc-ec09-4991-9a2a-fd664fe1fc28', 'SKU-0028', 'Mustard Seeds', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('9fb8cacb-ca58-461a-a518-994cd4f00e32', 'SKU-0029', 'Cumin Seeds', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('1056a75a-43f2-4cc0-bd5f-48e47d84f50e', 'SKU-0030', 'Coriander Powder', 'Masala', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('83dd53ca-16db-4832-a71c-b8888f58e436', 'SKU-0031', 'Turmeric Powder', 'Masala', 'Kg', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('515a126a-9329-4f34-b7a4-691519e235d5', 'SKU-0032', 'Red Chilli Powder', 'Masala', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('60ab5a5a-52ab-4790-8747-49900d2311de', 'SKU-0033', 'Black Pepper', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('6c34793c-0752-44ba-b446-9942593d4634', 'SKU-0034', 'Garam Masala', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c9a40c43-5a30-492d-ab09-570463cc0ee1', 'SKU-0035', 'Sambar Powder', 'Masala', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('9ce060d8-03bd-4934-8da1-427f157697ee', 'SKU-0036', 'Rasam Powder', 'Masala', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('749eed83-fc61-4332-a273-217fe0d79ba7', 'SKU-0037', 'Pav Bhaji Masala', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c7e5c615-292e-47a7-bf50-6c1df09ac231', 'SKU-0038', 'Kitchen King Masala', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('fc64167d-4f12-4f34-b892-33b4848cb870', 'SKU-0039', 'Chaat Masala', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('5ffc7fd7-4376-4d97-8523-fda3a96129e1', 'SKU-0040', 'Asafoetida (Hing)', 'Masala', 'Kg', 0.0, 0.0, 1.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('5b000cc2-dbda-44c6-bfcc-52339068d6a7', 'SKU-0041', 'Curry Leaves', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('87ea5e23-3109-4600-a200-31384c6efd1b', 'SKU-0042', 'Kasuri Methi', 'Masala', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('ae5ee197-08ec-414e-b6f0-6ccdf95a3c98', 'SKU-0043', 'Milk', 'Dairy', 'Ltr', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('cf87bb96-6d21-47bc-94d2-7da406b93a5c', 'SKU-0044', 'Curd', 'Dairy', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('cf2e9842-a81f-4185-aec1-343140102592', 'SKU-0045', 'Butter', 'Dairy', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('5d47b88d-5518-4553-912d-f839bf8f53aa', 'SKU-0046', 'Paneer', 'Dairy', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b8783d96-0b3e-493e-a0c3-a3c9700a9d77', 'SKU-0047', 'Cheese Slice', 'Dairy', 'Pack', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a9b71c2c-e986-42f7-8992-7895de03fc6b', 'SKU-0048', 'Cheese Block', 'Dairy', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('8a196ff6-9e60-465d-9bb4-2fca0b91da64', 'SKU-0049', 'Mozzarella Cheese', 'Dairy', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('aa4ea61e-bafb-4bb6-b5ca-e2ae31bda729', 'SKU-0050', 'Fresh Cream', 'Dairy', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('990e488d-a3eb-45c7-8c28-830163a25bef', 'SKU-0051', 'Buttermilk', 'Dairy', 'Ltr', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('3661fcf3-bd82-4cfa-9393-748175d457d7', 'SKU-0052', 'Potato', 'Vegetable', 'Kg', 0.0, 0.0, 50.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('81c20586-a732-4c11-a655-ead1d6c03ee0', 'SKU-0053', 'Onion', 'Vegetable', 'Kg', 0.0, 0.0, 50.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('67b5c1d3-df4b-4a8c-8e81-b29174375ec6', 'SKU-0054', 'Tomato', 'Vegetable', 'Kg', 0.0, 0.0, 40.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('1e82e781-ed41-495c-a03e-6cf5099e9e4c', 'SKU-0055', 'Green Chilli', 'Vegetable', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('17330a42-d8f2-4505-81b3-f740d73a286a', 'SKU-0056', 'Ginger', 'Vegetable', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a01d5a56-df38-4620-ac48-2d3edd0ba500', 'SKU-0057', 'Garlic', 'Vegetable', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('41c68f46-1133-4a22-8251-5c85a8dbff2a', 'SKU-0058', 'Coriander', 'Vegetable', 'Bundle', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('0118dd99-7c70-4269-b8ab-fda97c9a7bb8', 'SKU-0059', 'Lemon', 'Vegetable', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('55399fc5-abac-4dde-89f8-107bad20e123', 'SKU-0060', 'Capsicum', 'Vegetable', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('70384811-127b-42ce-a10a-7a501932ccfe', 'SKU-0061', 'Carrot', 'Vegetable', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('91ba8fdc-47ec-43fd-a67e-5a71e5a69f01', 'SKU-0062', 'Cabbage', 'Vegetable', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('d93d7020-f66c-4bdf-bf73-61804637c599', 'SKU-0063', 'Parcel Box Small', 'Packing', 'Pcs', 0.0, 0.0, 100.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('2529c58a-6b77-4197-9553-4724ddd07d87', 'SKU-0064', 'Parcel Box Medium', 'Packing', 'Pcs', 0.0, 0.0, 100.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('fc7142e4-b979-4a30-86af-bd4e5045924a', 'SKU-0065', 'Parcel Box Large', 'Packing', 'Pcs', 0.0, 0.0, 50.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('dc2e9cef-8bce-4683-91ed-c4029d6c72bb', 'SKU-0066', 'Paper Bag Small', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('0ee110b6-0acc-497d-8ea5-9abc996f3b87', 'SKU-0067', 'Paper Bag Medium', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('f1bf395a-2485-4cd9-b942-3909994e990f', 'SKU-0068', 'Paper Bag Large', 'Packing', 'Pcs', 0.0, 0.0, 100.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('bf13bbfc-2e55-4188-8c90-acfe3d73a642', 'SKU-0069', 'Carry Bag Small', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('263c5012-858b-4283-b449-313ff8c80d98', 'SKU-0070', 'Carry Bag Medium', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c3215892-5a44-48ef-975d-415faaa99e94', 'SKU-0071', 'Carry Bag Large', 'Packing', 'Pcs', 0.0, 0.0, 100.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('e7e7317e-e518-4027-807f-f131f3acb730', 'SKU-0072', 'Paper Cup 100ml', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('d6b6d6ec-966d-4e8f-a406-d203f158dd5d', 'SKU-0073', 'Paper Cup 200ml', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('2fb74d5d-5401-4e45-bbe9-b2a451202ced', 'SKU-0074', 'Paper Glass', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('3f3f8fd0-02de-4e5e-9682-d79d387f69b0', 'SKU-0075', 'Tissue Paper', 'Packing', 'Pkt', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('87816867-e2e8-4573-bcaa-8f6ebfaac43c', 'SKU-0076', 'Aluminium Foil', 'Packing', 'Roll', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('7ef7ac25-12e4-4414-bd0a-a49d8996dbcc', 'SKU-0077', 'Cling Film', 'Packing', 'Roll', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('976a5704-6f09-4bc4-bbfb-c0ec64710b26', 'SKU-0078', 'Butter Paper', 'Packing', 'Pkt', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('2cb531d4-a957-467a-bb3b-e16811d928f0', 'SKU-0079', 'Plastic Spoon', 'Packing', 'Pcs', 0.0, 0.0, 500.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('e55442fb-b270-4c6d-bc0c-6b1c5d6a34f5', 'SKU-0080', 'Plastic Fork', 'Packing', 'Pcs', 0.0, 0.0, 200.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('47b23382-a3c4-422b-a707-4c8d775a70f9', 'SKU-0081', 'Tooth Pick', 'Packing', 'Box', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a64fc869-0a01-48ec-84ba-ecc8a4e9d00b', 'SKU-0082', 'Garbage Bag', 'Packing', 'Pkt', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('39a321d3-7ba6-48a0-ab5b-a3edf316b238', 'SKU-0083', 'Dish Wash Liquid', 'Cleaning', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('433cef4d-e858-4300-b136-7e8e408defa6', 'SKU-0084', 'Floor Cleaner', 'Cleaning', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('281e0c20-338a-4bac-9fd5-b72054cb4bf2', 'SKU-0085', 'Hand Wash', 'Cleaning', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('9f86405e-1f08-4501-998c-d80dc86562a3', 'SKU-0086', 'Glass Cleaner', 'Cleaning', 'Ltr', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('43df6d42-793a-42f0-95b4-6007f240a43d', 'SKU-0087', 'Toilet Cleaner', 'Cleaning', 'Ltr', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('1340d69f-500b-4927-b683-e09230e7cc50', 'SKU-0088', 'Phenyl', 'Cleaning', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('f76d01dd-ac56-46d1-a3a7-be640d316b27', 'SKU-0089', 'Bleaching Powder', 'Cleaning', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('04cdef39-5903-4eee-9e94-901c856390a2', 'SKU-0090', 'Detergent Powder', 'Cleaning', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('78d3649c-9b04-49e7-b5e3-c2c9be4a153e', 'SKU-0091', 'Liquid Soap', 'Cleaning', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a951ee83-8223-43f3-b373-6932db1f962b', 'SKU-0092', 'Scrub Pad', 'Cleaning', 'Pcs', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('944df73f-cd07-4814-a4fc-7c2e5888694d', 'SKU-0093', 'Steel Scrubber', 'Cleaning', 'Pcs', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('81ff68f9-3834-4c73-8002-d4adf57fa0e2', 'SKU-0094', 'Cleaning Brush', 'Cleaning', 'Pcs', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a8e76a82-2420-4a12-8d80-c4846a287e60', 'SKU-0095', 'Mop Head', 'Cleaning', 'Pcs', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('2c2bc610-72cc-4554-b3f5-5bd9d56015a0', 'SKU-0096', 'Mop Stick', 'Cleaning', 'Pcs', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('f12759a3-359c-4ece-ad31-bf837de49e0e', 'SKU-0097', 'Broom', 'Cleaning', 'Pcs', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('4699194f-6f54-4a2b-b6f2-56994da8adf6', 'SKU-0098', 'Wiper', 'Cleaning', 'Pcs', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('8b2aa968-041a-448d-b06a-a98205a9688c', 'SKU-0099', 'Dustbin Bag', 'Cleaning', 'Pkt', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b7118e3e-f590-4997-98e9-07bc3d02aab4', 'SKU-0100', 'Cleaning Cloth', 'Cleaning', 'Pcs', 0.0, 0.0, 30.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('6417f947-facc-4ca9-af76-fd283bcb69e0', 'SKU-0101', 'Sanitizer', 'Cleaning', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c2911eef-1e39-4928-9af6-3c1dd363ff90', 'SKU-0102', 'Tea Powder', 'Beverage', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('62a2d3b8-cc45-4ab4-b877-f4fc7a0c69ad', 'SKU-0103', 'Coffee Powder', 'Beverage', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('e639d7ee-a1a5-421e-aa69-d0a5de9cde56', 'SKU-0104', 'Sugar Syrup', 'Beverage', 'Ltr', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('42f805e1-238d-4fb4-9ba7-02719ad8fbab', 'SKU-0105', 'Rose Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('24a66a54-2a55-44a4-ae4c-7410c7ab090d', 'SKU-0106', 'Kesar Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('21c2a5db-a118-4199-a336-69d056edef82', 'SKU-0107', 'Black Currant Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c4536d9f-9f92-4daa-90d9-48c72b17c1f2', 'SKU-0108', 'Guava Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('518b8cce-d7cb-45ac-942e-91305c0a10c9', 'SKU-0109', 'Blue Curacao Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('979f74d8-514a-47fd-9eaf-aa8e69a76b75', 'SKU-0110', 'Mint Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('a1ff1a77-0684-4ab6-9ab4-51de611a76a9', 'SKU-0111', 'Orange Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b38cfcbd-1906-4ae5-ac50-8a89c0eaca08', 'SKU-0112', 'Butter Scotch Syrup', 'Beverage', 'Bottle', 0.0, 0.0, 3.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('32b910f8-dce8-4434-b3ad-0cd182b50bdc', 'SKU-0113', 'Water Bottle', 'Beverage', 'Pcs', 0.0, 0.0, 48.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('fab326d9-ffaa-473f-884d-e62a7b1d6900', 'SKU-0114', 'Soda', 'Beverage', 'Bottle', 0.0, 0.0, 24.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('605ba739-0d0f-46db-b176-90d5a5fa920d', 'SKU-0115', 'Thumbs Up Tin', 'Beverage', 'Tin', 0.0, 0.0, 24.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b7121410-0b9c-4680-a3a4-e39de544952a', 'SKU-0116', 'Coca Cola Tin', 'Beverage', 'Tin', 0.0, 0.0, 24.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c327eef6-11e1-400d-ba42-a6bfb504a7b3', 'SKU-0117', 'Fanta Tin', 'Beverage', 'Tin', 0.0, 0.0, 24.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('edf0e1b3-049e-4e02-abba-36581d66f6fb', 'SKU-0118', 'Sprite Tin', 'Beverage', 'Tin', 0.0, 0.0, 24.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('74f243b6-3b60-4e32-8da8-c7c58abe03a1', 'SKU-0119', 'Maaza', 'Beverage', 'Bottle', 0.0, 0.0, 24.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('031acabd-3631-4b76-aefc-6a7fd7597178', 'SKU-0120', 'Pizza Base', 'Bakery', 'Pcs', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('46a645aa-b9ac-4dd1-b0e9-a75ffa781979', 'SKU-0121', 'Burger Bun', 'Bakery', 'Pcs', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('63fffcda-2703-434c-ab2a-34537a610e7d', 'SKU-0122', 'Sandwich Bread', 'Bakery', 'Loaf', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('3517c029-e865-4033-84ea-b8f6a82d474a', 'SKU-0123', 'Garlic Bread', 'Bakery', 'Pcs', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('abaed801-d5a7-41d4-9f91-17c4cff0778f', 'SKU-0124', 'Hot Dog Bun', 'Bakery', 'Pcs', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('189d8b55-669f-47ec-8002-a368a646e831', 'SKU-0125', 'Pav', 'Bakery', 'Pcs', 0.0, 0.0, 50.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('7a96dc9e-47ae-44da-a31f-eaadbadbc09a', 'SKU-0126', 'Idli Rice', 'Grocery', 'Kg', 0.0, 0.0, 50.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('89d5bd7a-c268-4192-85c9-af8c2f6ac68c', 'SKU-0127', 'Dosa Rice', 'Grocery', 'Kg', 0.0, 0.0, 50.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('36ec08fa-f748-44ba-9163-a8ff0f431c79', 'SKU-0128', 'Urad Gota', 'Grocery', 'Kg', 0.0, 0.0, 25.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('baa034eb-e530-465f-b472-f4d5860dbe1d', 'SKU-0129', 'Poha', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('40e54407-2132-4838-9fbc-d4125f6fd3c3', 'SKU-0130', 'Avalakki', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('dee75570-7a72-444a-9a1f-ab5f6bc886df', 'SKU-0131', 'Semolina (Rava)', 'Grocery', 'Kg', 0.0, 0.0, 25.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('741e3484-33fe-4d95-8e82-df42299168a4', 'SKU-0132', 'Sabudana', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('7ab606b1-33bb-4ff5-afc3-ef3e7b3079ae', 'SKU-0133', 'Tamarind Paste', 'Grocery', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('2078e240-db99-4d19-afda-e26412204b0f', 'SKU-0134', 'Coconut Powder', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('e4e4802c-6957-4106-981a-c22511665437', 'SKU-0135', 'Roasted Chana Dal', 'Grocery', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('ed070783-bc72-44f4-865c-845e6884ac85', 'SKU-0136', 'Fresh Coconut', 'Vegetable', 'Pcs', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('7d3f0a64-dcf8-4a61-8a3c-720417bd0ad8', 'SKU-0137', 'Green Coriander', 'Vegetable', 'Bundle', 0.0, 0.0, 20.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b431b678-e931-4b80-8b43-639d988ebb58', 'SKU-0138', 'Spring Onion', 'Vegetable', 'Bundle', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('59da93af-7839-4e24-ade5-b974d061e53e', 'SKU-0139', 'Beans', 'Vegetable', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('58b2919f-d1f9-4b7f-a422-09fe0b37ede9', 'SKU-0140', 'Sweet Corn', 'Frozen', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('32d65ab9-697a-47f1-9959-92d271a5a0ff', 'SKU-0141', 'Baby Corn', 'Frozen', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('186ada43-a48f-4278-bd45-beb722ab7d88', 'SKU-0142', 'Mushroom', 'Frozen', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b574878f-cb23-445a-977b-4045a8feee24', 'SKU-0143', 'Paneer Cubes', 'Frozen', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('c30a6e06-d389-443a-8289-b2147ef0483f', 'SKU-0144', 'French Fries', 'Frozen', 'Kg', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('d834aa8b-1471-43ec-a4d3-1930e495aa90', 'SKU-0145', 'Cashew', 'Dry Fruits', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b06362d5-eb04-4686-a140-a995782be00f', 'SKU-0146', 'Almond', 'Dry Fruits', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('9ffc11f5-c4b4-4ca0-936c-01341f9203d2', 'SKU-0147', 'Raisin', 'Dry Fruits', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('ddf377d3-a05a-4de0-8d2a-fc14fb50e647', 'SKU-0148', 'Pista', 'Dry Fruits', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('8d233e4e-d0e7-4cf2-8560-a230e03b2bba', 'SKU-0149', 'Walnut', 'Dry Fruits', 'Kg', 0.0, 0.0, 2.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('0d1ecdf2-bbbb-44d0-9674-b492b37fe4b7', 'SKU-0150', 'Dates', 'Dry Fruits', 'Kg', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('b947a46a-6d5e-43c5-9c1c-51c13a9595d0', 'SKU-0151', 'RICE', 'GROCERY', 'KG', 0.0, 0.0, 10.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO products (id, sku, name, category, unit, opening_stock, total_stock, minimum_threshold) VALUES ('acb837ee-b607-489d-ac6a-95f55136612d', 'SKU-0152', 'TEST ITEM', 'TEST ITEM', 'KG', 0.0, 0.0, 5.0) ON CONFLICT (name) DO NOTHING;
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'IN', 10.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('634efd95-9268-4388-a5e5-51dc55739395', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('0d1ecdf2-bbbb-44d0-9674-b492b37fe4b7', 'IN', 1.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'IN', 10.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('634efd95-9268-4388-a5e5-51dc55739395', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('0d1ecdf2-bbbb-44d0-9674-b492b37fe4b7', 'IN', 1.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'IN', 10.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('634efd95-9268-4388-a5e5-51dc55739395', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('0d1ecdf2-bbbb-44d0-9674-b492b37fe4b7', 'IN', 1.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'IN', 10.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('634efd95-9268-4388-a5e5-51dc55739395', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('0d1ecdf2-bbbb-44d0-9674-b492b37fe4b7', 'IN', 1.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'IN', 10.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('634efd95-9268-4388-a5e5-51dc55739395', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('0d1ecdf2-bbbb-44d0-9674-b492b37fe4b7', 'IN', 1.0, 'Kg', 'Excel Migration Stock In', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('2a7666f5-d9ab-4e22-96f1-8b9136590acb', 'IN', 5.0, 'Bottle', 'VIJAY', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 2.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'Kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 1.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
INSERT INTO stock_transactions (product_id, change_type, quantity, unit, remark, created_by_name) VALUES ('22d69cc1-4255-4b01-b347-f01e5ed65b8a', 'OUT', 3.0, 'kg', 'Excel Migration Stock Out', 'System Migration');
