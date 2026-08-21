-- ===================================================
-- DATABASE SECURITY MIGRATION - MULTI-TENANCY & RLS POLICIES
-- ===================================================

-- 1. CREATE RESTAURANTS TABLE
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. SEED DEFAULT RESTAURANT & FIXED OWNER ACCOUNT FOR PRODUCTION USE
INSERT INTO public.restaurants (id, name)
VALUES ('d0f11111-1111-1111-1111-d0f111111111', 'Rajubhai Dosawala')
ON CONFLICT (id) DO UPDATE SET name = 'Rajubhai Dosawala';

-- Enable secure crypt algorithms for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Seed the fixed owner account in Supabase Auth system
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'f0e11111-1111-1111-1111-f0e111111111',
    'authenticated',
    'authenticated',
    'rajubhaidosawala1060@gmail.com',
    crypt('rdw01082016', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Rajubhai Dosawala Owner","role":"owner","restaurant_id":"d0f11111-1111-1111-1111-d0f111111111"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
)
ON CONFLICT (id) DO NOTHING;

-- Seed the fixed owner profile in public users table
INSERT INTO public.users (id, email, name, role, restaurant_id)
VALUES (
    'f0e11111-1111-1111-1111-f0e111111111',
    'rajubhaidosawala1060@gmail.com',
    'Rajubhai Dosawala Owner',
    'owner',
    'd0f11111-1111-1111-1111-d0f111111111'
)
ON CONFLICT (id) DO NOTHING;

-- 3. MIGRATE USERS TABLE
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
UPDATE public.users SET restaurant_id = 'd0f11111-1111-1111-1111-d0f111111111' WHERE restaurant_id IS NULL;
ALTER TABLE public.users ALTER COLUMN restaurant_id SET NOT NULL;

-- 4. MIGRATE PRODUCTS TABLE
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
UPDATE public.products SET restaurant_id = 'd0f11111-1111-1111-1111-d0f111111111' WHERE restaurant_id IS NULL;
ALTER TABLE public.products ALTER COLUMN restaurant_id SET NOT NULL;

-- Remove legacy global uniqueness constraints to allow identical product names across different restaurants
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_name_key;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;

-- Add restaurant-scoped uniqueness constraints
ALTER TABLE public.products ADD CONSTRAINT products_restaurant_name_key UNIQUE (restaurant_id, name);
ALTER TABLE public.products ADD CONSTRAINT products_restaurant_sku_key UNIQUE (restaurant_id, sku);

-- 5. MIGRATE STOCK TRANSACTIONS TABLE
ALTER TABLE public.stock_transactions ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
UPDATE public.stock_transactions st 
SET restaurant_id = p.restaurant_id
FROM public.products p
WHERE st.product_id = p.id AND st.restaurant_id IS NULL;
UPDATE public.stock_transactions SET restaurant_id = 'd0f11111-1111-1111-1111-d0f111111111' WHERE restaurant_id IS NULL;
ALTER TABLE public.stock_transactions ALTER COLUMN restaurant_id SET NOT NULL;

-- 6. MIGRATE SYSTEM SETTINGS TABLE
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
UPDATE public.system_settings SET restaurant_id = 'd0f11111-1111-1111-1111-d0f111111111' WHERE restaurant_id IS NULL;
ALTER TABLE public.system_settings ALTER COLUMN restaurant_id SET NOT NULL;

-- Re-establish primary key on restaurant_id since settings are 1:1 per restaurant
ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (restaurant_id);

-- 7. MIGRATE LOW STOCK ALERTS LOG TABLE
ALTER TABLE public.low_stock_alerts_log ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
UPDATE public.low_stock_alerts_log al 
SET restaurant_id = p.restaurant_id
FROM public.products p
WHERE al.product_id = p.id AND al.restaurant_id IS NULL;
UPDATE public.low_stock_alerts_log SET restaurant_id = 'd0f11111-1111-1111-1111-d0f111111111' WHERE restaurant_id IS NULL;
ALTER TABLE public.low_stock_alerts_log ALTER COLUMN restaurant_id SET NOT NULL;

-- 8. RECREATE VIEWS WITH RESTAURANT ISOLATION
DROP VIEW IF EXISTS public.v_low_stock CASCADE;
DROP VIEW IF EXISTS public.v_live_stock CASCADE;

CREATE OR REPLACE VIEW public.v_live_stock AS
SELECT 
    p.id,
    p.restaurant_id,
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
GROUP BY p.id, p.restaurant_id;

CREATE OR REPLACE VIEW public.v_low_stock AS
SELECT * FROM v_live_stock
WHERE current_stock <= minimum_threshold;

-- 9. DEFINE SECURITY FUNCTIONS & POLICIES
-- Drop existing policies to avoid duplications
DROP POLICY IF EXISTS "Users are viewable by authenticated users" ON public.users;
DROP POLICY IF EXISTS "Owners and Managers can manage users" ON public.users;
DROP POLICY IF EXISTS "Products are viewable by all authenticated users" ON public.products;
DROP POLICY IF EXISTS "Owners and Managers can create products" ON public.products;
DROP POLICY IF EXISTS "Owners and Managers can update products" ON public.products;
DROP POLICY IF EXISTS "Owners and Managers can delete products" ON public.products;
DROP POLICY IF EXISTS "Transactions viewable by all authenticated users" ON public.stock_transactions;
DROP POLICY IF EXISTS "All authenticated users can log transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Owners and Managers can delete transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Users can view their own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Allow restaurant creation during signup" ON public.restaurants;
DROP POLICY IF EXISTS "Owners can manage their restaurant" ON public.restaurants;

-- Create helper function to fetch current user's restaurant_id securely
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT restaurant_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on restaurants table
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Restaurants Policies
CREATE POLICY "Users can view their own restaurant" ON public.restaurants
FOR SELECT TO authenticated USING (id = public.get_user_restaurant_id());

CREATE POLICY "Allow restaurant creation during signup" ON public.restaurants
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Owners can manage their restaurant" ON public.restaurants
FOR ALL TO authenticated USING (
    id = public.get_user_restaurant_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
);

-- Users Policies
CREATE POLICY "Users can view coworkers" ON public.users
FOR SELECT TO authenticated USING (restaurant_id = public.get_user_restaurant_id());

CREATE POLICY "Allow profile creation during signup" ON public.users
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Owners and managers can manage restaurant users" ON public.users
FOR ALL TO authenticated USING (
    restaurant_id = public.get_user_restaurant_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

-- Products Policies
CREATE POLICY "Users can view restaurant products" ON public.products
FOR SELECT TO authenticated USING (restaurant_id = public.get_user_restaurant_id());

CREATE POLICY "Owners/managers can insert products" ON public.products
FOR INSERT TO authenticated WITH CHECK (
    restaurant_id = public.get_user_restaurant_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

CREATE POLICY "Owners/managers can update products" ON public.products
FOR UPDATE TO authenticated USING (
    restaurant_id = public.get_user_restaurant_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

CREATE POLICY "Owners/managers can delete products" ON public.products
FOR DELETE TO authenticated USING (
    restaurant_id = public.get_user_restaurant_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

-- Stock Transactions Policies
CREATE POLICY "Users can view restaurant transactions" ON public.stock_transactions
FOR SELECT TO authenticated USING (restaurant_id = public.get_user_restaurant_id());

CREATE POLICY "Users can log transactions" ON public.stock_transactions
FOR INSERT TO authenticated WITH CHECK (
    restaurant_id = public.get_user_restaurant_id()
);

CREATE POLICY "Owners/managers can delete transactions" ON public.stock_transactions
FOR DELETE TO authenticated USING (
    restaurant_id = public.get_user_restaurant_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

-- System Settings Policies
CREATE POLICY "Users can view restaurant settings" ON public.system_settings
FOR SELECT TO authenticated USING (restaurant_id = public.get_user_restaurant_id());

CREATE POLICY "Owners can manage settings" ON public.system_settings
FOR ALL TO authenticated USING (
    restaurant_id = public.get_user_restaurant_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
);

-- Low Stock Alerts Log Policies
CREATE POLICY "Users can view restaurant alerts" ON public.low_stock_alerts_log
FOR SELECT TO authenticated USING (restaurant_id = public.get_user_restaurant_id());

CREATE POLICY "System/backend can insert alerts" ON public.low_stock_alerts_log
FOR INSERT TO authenticated WITH CHECK (restaurant_id = public.get_user_restaurant_id());
