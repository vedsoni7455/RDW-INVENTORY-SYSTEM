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
