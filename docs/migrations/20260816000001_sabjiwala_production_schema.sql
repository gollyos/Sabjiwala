-- =============================================================================
-- SABJIWALA PRODUCTION DATABASE MIGRATION
-- Target Database: PostgreSQL 17+ (Supabase)
-- Timezone Reference: Asia/Kolkata (IST - UTC+05:30)
-- =============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & SEQUENCES
DO $$ BEGIN
    CREATE TYPE order_channel_type AS ENUM ('web', 'manual_admin', 'phone_whatsapp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status_type AS ENUM (
        'payment_pending',
        'confirmed',
        'in_procurement',
        'packed',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'failed_delivery'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM (
        'cod',
        'online_upi',
        'online_card',
        'online_netbanking'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM (
        'pending',
        'completed',
        'failed',
        'refunded',
        'partially_refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE promo_discount_type AS ENUM ('percentage', 'flat');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE promo_usage_status_type AS ENUM ('reserved', 'consumed', 'released');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE procurement_batch_status_type AS ENUM ('open', 'locked', 'procured', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_batch_status_type AS ENUM ('draft', 'assigned', 'out_for_delivery', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status_type AS ENUM ('pending', 'out_for_delivery', 'delivered', 'failed', 'rescheduled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE staff_role_type AS ENUM ('owner', 'manager', 'packing', 'delivery');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE webhook_status_type AS ENUM ('pending', 'processed', 'ignored', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_type_enum AS ENUM (
        'quality_issue',
        'missing_item',
        'wrong_item',
        'weight_discrepancy',
        'late_delivery',
        'billing_issue',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status_enum AS ENUM ('open', 'investigating', 'resolved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE SEQUENCE IF NOT EXISTS customer_verified_sequence START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 10001 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS complaint_number_seq START WITH 1001 INCREMENT BY 1 NO CYCLE;


-- =============================================================================
-- 3. STAFF PROFILES & RBAC ROLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role staff_role_type NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES user_profiles(id),
    CONSTRAINT uq_user_role UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id, role);


-- =============================================================================
-- 4. CUSTOMERS & MULTI-ADDRESSES
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL CONSTRAINT chk_customer_mobile CHECK (mobile ~ '^\+?[0-9]{10,15}$'),
    full_name TEXT NOT NULL,
    alternate_mobile VARCHAR(15),
    email TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_sequence INT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_verified_seq ON customers(verified_sequence) WHERE is_verified = true;

CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL DEFAULT 'home' CHECK (address_type IN ('home', 'work', 'temporary')),
    flat_house_no TEXT NOT NULL,
    society_street_name TEXT NOT NULL,
    landmark TEXT NOT NULL,
    area_locality TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Halol',
    district TEXT NOT NULL DEFAULT 'Panchmahal',
    state TEXT NOT NULL DEFAULT 'Gujarat',
    pincode VARCHAR(10) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_default_address 
ON customer_addresses (customer_id) 
WHERE is_default = true AND is_deleted = false;


-- =============================================================================
-- 5. CATALOG, VARIANTS & PRICING
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    name_gu VARCHAR(100) NOT NULL,
    image_url TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name_en VARCHAR(50) NOT NULL,
    name_gu VARCHAR(50) NOT NULL,
    unit_type VARCHAR(20) NOT NULL CHECK (unit_type IN ('weight', 'count', 'bundle')),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    base_unit_id UUID NOT NULL REFERENCES product_units(id) ON DELETE RESTRICT,
    slug VARCHAR(150) UNIQUE NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_gu VARCHAR(150) NOT NULL,
    description_en TEXT,
    description_gu TEXT,
    image_url TEXT,
    is_seasonal BOOLEAN NOT NULL DEFAULT false,
    is_in_stock BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category_order ON products(category_id, display_order);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES product_units(id) ON DELETE RESTRICT,
    sku VARCHAR(50) UNIQUE,
    variant_name_en VARCHAR(100) NOT NULL,
    variant_name_gu VARCHAR(100) NOT NULL,
    multiplier_to_base_unit NUMERIC(10, 4) NOT NULL CHECK (multiplier_to_base_unit > 0),
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    current_estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (current_estimated_cost >= 0),
    min_order_qty NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
    max_order_qty NUMERIC(10, 3) NOT NULL DEFAULT 20.000,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_default_variant 
ON product_variants (product_id) 
WHERE is_default = true AND is_active = true;

CREATE TABLE IF NOT EXISTS selling_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    changed_by UUID REFERENCES user_profiles(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_selling_price_hist ON selling_price_history(product_variant_id, effective_at DESC);


-- =============================================================================
-- 6. SUPPLIERS & PROCUREMENT PRICING
-- =============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    mobile VARCHAR(15) NOT NULL,
    mandi_location VARCHAR(150) DEFAULT 'Halol APMC Market, Panchmahal',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    last_negotiated_cost_per_base_unit NUMERIC(10, 2) NOT NULL CHECK (last_negotiated_cost_per_base_unit >= 0),
    is_preferred BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_supplier_product UNIQUE (supplier_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON supplier_products(product_id);

CREATE TABLE IF NOT EXISTS supplier_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cost_price_per_base_unit NUMERIC(10, 2) NOT NULL CHECK (cost_price_per_base_unit >= 0),
    changed_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_price_hist ON supplier_price_history(supplier_id, product_id, effective_at DESC);


-- =============================================================================
-- 7. ORDERS & ORDER ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    delivery_address_id UUID NOT NULL REFERENCES customer_addresses(id) ON DELETE RESTRICT,
    channel order_channel_type NOT NULL DEFAULT 'web',
    order_status order_status_type NOT NULL DEFAULT 'payment_pending',
    payment_method payment_method_type NOT NULL,
    payment_status payment_status_type NOT NULL DEFAULT 'pending',

    minimum_order_amount_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    subtotal_amount NUMERIC(10, 2) NOT NULL CHECK (subtotal_amount >= 0),
    first_order_discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (first_order_discount >= 0),
    promo_discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (promo_discount >= 0),
    cod_discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cod_discount >= 0),
    delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_charge >= 0),
    final_payable_amount NUMERIC(10, 2) NOT NULL CHECK (final_payable_amount >= 0),
    total_cost_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost_amount >= 0),

    placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    is_before_cutoff BOOLEAN,
    delivery_date DATE,
    delivery_slot_start TIME DEFAULT '10:00:00',
    delivery_slot_end TIME DEFAULT '13:00:00',

    customer_name_snapshot TEXT NOT NULL,
    customer_mobile_snapshot VARCHAR(15) NOT NULL,
    customer_alternate_mobile_snapshot VARCHAR(15),

    delivery_flat_house_snapshot TEXT NOT NULL,
    delivery_society_street_snapshot TEXT NOT NULL,
    delivery_landmark_snapshot TEXT NOT NULL,
    delivery_area_snapshot TEXT NOT NULL,
    delivery_city_snapshot TEXT NOT NULL DEFAULT 'Halol',
    delivery_district_snapshot TEXT NOT NULL DEFAULT 'Panchmahal',
    delivery_pincode_snapshot VARCHAR(10) NOT NULL,
    delivery_latitude_snapshot NUMERIC(10, 7),
    delivery_longitude_snapshot NUMERIC(10, 7),
    customer_snapshot_json JSONB NOT NULL,

    special_instructions TEXT,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES user_profiles(id),
    created_by_staff_id UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_address ON orders(delivery_address_id);
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_date ON orders(delivery_date, order_status, confirmed_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES product_units(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
    equivalent_base_qty NUMERIC(10, 3) NOT NULL CHECK (equivalent_base_qty > 0),

    product_name_en_snapshot VARCHAR(150) NOT NULL,
    product_name_gu_snapshot VARCHAR(150) NOT NULL,
    variant_name_en_snapshot VARCHAR(100) NOT NULL,
    variant_name_gu_snapshot VARCHAR(100) NOT NULL,
    unit_code_snapshot VARCHAR(20) NOT NULL,
    selling_price_snapshot NUMERIC(10, 2) NOT NULL CHECK (selling_price_snapshot >= 0),
    cost_price_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price_snapshot >= 0),
    line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
    line_cost_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (line_cost_total >= 0),

    packed_quantity NUMERIC(10, 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(product_variant_id);


-- =============================================================================
-- 8. MANDI PROCUREMENT BATCHES (FROZEN 8 PM SNAPSHOT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS procurement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    batch_date DATE NOT NULL UNIQUE,
    cutoff_timestamp TIMESTAMPTZ NOT NULL,
    status procurement_batch_status_type NOT NULL DEFAULT 'open',
    total_orders_count INT NOT NULL DEFAULT 0,
    total_procurement_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_received_weight_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    total_usable_weight_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    total_wastage_weight_kg NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_batch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES procurement_batches(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    order_number_snapshot VARCHAR(30) NOT NULL,
    order_confirmed_at_snapshot TIMESTAMPTZ NOT NULL,
    order_item_count_snapshot INT NOT NULL,
    locked_into_batch_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_proc_batch_single_order UNIQUE (order_id),
    CONSTRAINT uq_batch_order_pair UNIQUE (batch_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_orders_batch ON procurement_batch_orders(batch_id);

CREATE TABLE IF NOT EXISTS procurement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES procurement_batches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    base_unit_id UUID NOT NULL REFERENCES product_units(id) ON DELETE RESTRICT,
    required_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    procured_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    received_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    usable_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    wastage_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    total_procurement_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    effective_cost_per_usable_unit NUMERIC(10, 2),
    notes TEXT,
    CONSTRAINT uq_batch_product UNIQUE (batch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_procurement_items_batch ON procurement_items(batch_id);

CREATE TABLE IF NOT EXISTS procurement_purchase_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_item_id UUID NOT NULL REFERENCES procurement_items(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchased_qty NUMERIC(10, 3) NOT NULL CHECK (purchased_qty >= 0),
    rate_per_unit NUMERIC(10, 2) NOT NULL CHECK (rate_per_unit >= 0),
    total_cost NUMERIC(10, 2) NOT NULL CHECK (total_cost >= 0),
    mandi_lot_or_bill_no VARCHAR(100),
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    purchased_by UUID REFERENCES user_profiles(id),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_proc_purchase_lines_item ON procurement_purchase_lines(procurement_item_id);
CREATE INDEX IF NOT EXISTS idx_proc_purchase_lines_supplier ON procurement_purchase_lines(supplier_id);


-- =============================================================================
-- 9. PAYMENTS, WEBHOOKS & PROMOTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(150) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    processed_status webhook_status_type NOT NULL DEFAULT 'pending',
    processing_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_gateway_event UNIQUE (gateway_provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON payment_webhook_events(processed_status, created_at);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    payment_method payment_method_type NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    status payment_status_type NOT NULL DEFAULT 'pending',
    gateway_provider VARCHAR(50),
    gateway_transaction_id VARCHAR(100),
    webhook_event_id UUID REFERENCES payment_webhook_events(id),
    gateway_response JSONB,
    collected_by_delivery_user_id UUID REFERENCES user_profiles(id),
    collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type promo_discount_type NOT NULL,
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_subtotal_amount NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    max_discount_cap NUMERIC(10, 2),
    first_order_only BOOLEAN NOT NULL DEFAULT false,
    max_verified_customer_seq INT,
    total_usage_limit INT,
    per_customer_limit INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promotion_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status promo_usage_status_type NOT NULL DEFAULT 'reserved',
    discount_amount_applied NUMERIC(10, 2) NOT NULL CHECK (discount_amount_applied >= 0),
    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at TIMESTAMPTZ,
    release_reason TEXT,
    CONSTRAINT uq_promotion_order UNIQUE (promotion_id, customer_id, order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_promo_per_customer 
ON promotion_usage (promotion_id, customer_id) 
WHERE status IN ('reserved', 'consumed');


-- =============================================================================
-- 10. PACKING BAGS & ROUTE DISPATCH
-- =============================================================================

CREATE TABLE IF NOT EXISTS packing_bags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    bag_barcode VARCHAR(50) UNIQUE NOT NULL,
    bag_sequence INT NOT NULL DEFAULT 1,
    measured_weight_kg NUMERIC(10, 3),
    packed_by_user_id UUID REFERENCES user_profiles(id),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    packed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_bag_sequence UNIQUE (order_id, bag_sequence)
);

CREATE INDEX IF NOT EXISTS idx_packing_bags_order ON packing_bags(order_id);

CREATE TABLE IF NOT EXISTS delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(100) NOT NULL,
    delivery_date DATE NOT NULL,
    delivery_slot VARCHAR(30) NOT NULL DEFAULT '10:00 AM - 01:00 PM',
    driver_user_id UUID REFERENCES user_profiles(id),
    status delivery_batch_status_type NOT NULL DEFAULT 'assigned',
    total_deliveries INT NOT NULL DEFAULT 0,
    completed_deliveries INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_batches_date ON delivery_batches(delivery_date, driver_user_id);

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_batch_id UUID REFERENCES delivery_batches(id) ON DELETE SET NULL,
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_user_id UUID REFERENCES user_profiles(id),
    delivery_sequence INT NOT NULL DEFAULT 0,
    status delivery_status_type NOT NULL DEFAULT 'pending',
    cod_amount_expected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cod_amount_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_otp VARCHAR(6),
    customer_signature_url TEXT,
    proof_of_delivery_photo_url TEXT,
    failure_reason VARCHAR(100),
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_batch ON deliveries(delivery_batch_id, delivery_sequence);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_user_id, status);


-- =============================================================================
-- 11. COMPLAINTS, AUDIT LOGS & APP SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(30) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    complaint_type complaint_type_enum NOT NULL,
    description TEXT NOT NULL,
    evidence_photo_urls TEXT[],
    status complaint_status_enum NOT NULL DEFAULT 'open',
    resolution_notes TEXT,
    refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (refund_amount >= 0),
    assigned_to UUID REFERENCES user_profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_customer ON complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_order ON complaints(order_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id TEXT NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    actor_user_id UUID REFERENCES auth.users(id),
    actor_role VARCHAR(30),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES user_profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- 12. FUNCTIONS, TRIGGERS & PROCEDURES
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' 
          AND table_name IN (
            'user_profiles', 'customers', 'customer_addresses', 'categories',
            'products', 'product_variants', 'suppliers', 'supplier_products',
            'orders', 'procurement_batches', 'payments', 'promotions',
            'delivery_batches', 'deliveries', 'complaints'
          )
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
            CREATE TRIGGER trg_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- Immutability for Audit Logs
CREATE OR REPLACE FUNCTION trigger_prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are strictly append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION trigger_prevent_audit_log_mutation();

-- Human-Readable Order Number Generator
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    today_str TEXT;
    seq_val BIGINT;
BEGIN
    today_str := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYMMDD');
    seq_val := nextval('order_number_seq');
    RETURN 'SBJ-' || today_str || '-' || lpad(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Protect Customer Security Fields
CREATE OR REPLACE FUNCTION trigger_protect_customer_security_fields()
RETURNS TRIGGER AS $$
DECLARE
    is_staff BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'manager')
    ) INTO is_staff;

    IF NOT is_staff THEN
        IF NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
           NEW.verified_at IS DISTINCT FROM OLD.verified_at OR
           NEW.verified_sequence IS DISTINCT FROM OLD.verified_sequence OR
           NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id OR
           NEW.mobile IS DISTINCT FROM OLD.mobile THEN
            RAISE EXCEPTION 'Unauthorized: Verified security credentials and phone number cannot be modified directly by the user.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_protect_customer_security ON customers;
CREATE TRIGGER trg_protect_customer_security
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trigger_protect_customer_security_fields();

-- Automated Audit Trigger Function
CREATE OR REPLACE FUNCTION trigger_record_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT := 'system';
    v_rec_id TEXT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_rec_id := COALESCE(v_old->>'id', v_old->>'key', 'unknown');
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_rec_id := COALESCE(v_new->>'id', v_new->>'key', v_old->>'id', v_old->>'key', 'unknown');
    ELSIF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
        v_rec_id := COALESCE(v_new->>'id', v_new->>'key', 'unknown');
    END IF;

    SELECT ur.role::text INTO v_role 
    FROM user_roles ur 
    WHERE ur.user_id = v_user_id 
    LIMIT 1;

    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        actor_user_id,
        actor_role,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        v_rec_id,
        TG_OP,
        v_old,
        v_new,
        v_user_id,
        COALESCE(v_role, 'system'),
        now()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_audit_product_variants ON product_variants;
CREATE TRIGGER trg_audit_product_variants
AFTER INSERT OR UPDATE OR DELETE ON product_variants
FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_supplier_products ON supplier_products;
CREATE TRIGGER trg_audit_supplier_products
AFTER INSERT OR UPDATE OR DELETE ON supplier_products
FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_orders ON orders;
CREATE TRIGGER trg_audit_orders
AFTER UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_promotions ON promotions;
CREATE TRIGGER trg_audit_promotions
AFTER INSERT OR UPDATE OR DELETE ON promotions
FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_app_settings ON app_settings;
CREATE TRIGGER trg_audit_app_settings
AFTER INSERT OR UPDATE OR DELETE ON app_settings
FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();


-- =============================================================================
-- 13. VIEWS & RPCS
-- =============================================================================

CREATE OR REPLACE VIEW public_catalog_products AS
SELECT 
    p.id,
    p.category_id,
    p.base_unit_id,
    p.slug,
    p.name_en,
    p.name_gu,
    p.description_en,
    p.description_gu,
    p.image_url,
    p.is_seasonal,
    p.is_in_stock,
    p.display_order
FROM products p
WHERE p.is_active = true AND p.is_in_stock = true;

CREATE OR REPLACE VIEW public_catalog_variants AS
SELECT 
    pv.id,
    pv.product_id,
    pv.unit_id,
    pv.sku,
    pv.variant_name_en,
    pv.variant_name_gu,
    pv.multiplier_to_base_unit,
    pv.selling_price,
    pv.min_order_qty,
    pv.max_order_qty,
    pv.is_default,
    pv.display_order
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true AND p.is_in_stock = true;

-- Verification RPC
CREATE OR REPLACE FUNCTION verify_customer_phone(p_customer_id UUID)
RETURNS INT AS $$
DECLARE
    v_cust RECORD;
    v_seq INT;
BEGIN
    SELECT is_verified, verified_sequence INTO v_cust
    FROM customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer % not found.', p_customer_id;
    END IF;

    IF v_cust.is_verified THEN
        RETURN v_cust.verified_sequence;
    END IF;

    SELECT nextval('customer_verified_sequence') INTO v_seq;

    UPDATE customers
    SET is_verified = true,
        verified_at = now(),
        verified_sequence = v_seq,
        updated_at = now()
    WHERE id = p_customer_id;

    RETURN v_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION verify_customer_phone(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_customer_phone(UUID) TO authenticated, service_role;

-- Order Creation RPC
CREATE OR REPLACE FUNCTION create_customer_order(
    p_customer_address_id UUID,
    p_payment_method payment_method_type,
    p_items JSONB,
    p_promo_code TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_channel order_channel_type DEFAULT 'web'
)
RETURNS JSONB AS $$
DECLARE
    v_customer RECORD;
    v_address RECORD;
    v_min_order NUMERIC(10, 2);
    v_subtotal NUMERIC(10, 2) := 0.00;
    v_total_cost NUMERIC(10, 2) := 0.00;
    v_first_order_discount NUMERIC(10, 2) := 0.00;
    v_promo_discount NUMERIC(10, 2) := 0.00;
    v_cod_discount NUMERIC(10, 2) := 0.00;
    v_base_discounted_total NUMERIC(10, 2) := 0.00;
    v_final_payable NUMERIC(10, 2) := 0.00;
    v_order_id UUID;
    v_order_number TEXT;
    v_item JSONB;
    v_variant RECORD;
    v_line_total NUMERIC(10, 2);
    v_line_cost NUMERIC(10, 2);
    v_promo RECORD;
    v_ist_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_customer 
    FROM customers 
    WHERE auth_user_id = auth.uid() AND is_active = true;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'Customer profile not found or inactive for current session.';
    END IF;

    SELECT * INTO v_address 
    FROM customer_addresses 
    WHERE id = p_customer_address_id AND customer_id = v_customer.id AND is_deleted = false;

    IF v_address.id IS NULL THEN
        RAISE EXCEPTION 'Valid delivery address not found.';
    END IF;

    SELECT (value->>'amount')::numeric INTO v_min_order 
    FROM app_settings 
    WHERE key = 'min_order_amount';

    IF v_min_order IS NULL THEN
        v_min_order := 200.00;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT 
            pv.id AS variant_id,
            pv.product_id,
            pv.unit_id,
            pv.variant_name_en,
            pv.variant_name_gu,
            pv.multiplier_to_base_unit,
            pv.selling_price,
            pv.current_estimated_cost,
            p.name_en AS product_name_en,
            p.name_gu AS product_name_gu,
            u.code AS unit_code
        INTO v_variant
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        JOIN product_units u ON pv.unit_id = u.id
        WHERE pv.id = (v_item->>'variant_id')::uuid 
          AND pv.is_active = true 
          AND p.is_active = true 
          AND p.is_in_stock = true;

        IF v_variant.variant_id IS NULL THEN
            RAISE EXCEPTION 'Product variant % is unavailable or out of stock.', (v_item->>'variant_id');
        END IF;

        v_line_total := round(v_variant.selling_price * (v_item->>'quantity')::numeric, 2);
        v_line_cost := round(v_variant.current_estimated_cost * (v_item->>'quantity')::numeric, 2);

        v_subtotal := v_subtotal + v_line_total;
        v_total_cost := v_total_cost + v_line_cost;
    END LOOP;

    IF v_subtotal < v_min_order THEN
        RAISE EXCEPTION 'Minimum order amount is ₹%. Current subtotal is ₹%.', v_min_order, v_subtotal;
    END IF;

    -- FIRST500 Promo Check
    IF v_customer.is_verified AND v_customer.verified_sequence IS NOT NULL AND v_customer.verified_sequence <= 500 THEN
        SELECT p.* INTO v_promo FROM promotions p WHERE p.promo_code = 'FIRST500' AND p.is_active = true;
        
        IF v_promo.id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM promotion_usage 
            WHERE promotion_id = v_promo.id 
              AND customer_id = v_customer.id 
              AND status IN ('reserved', 'consumed')
        ) THEN
            v_first_order_discount := round(v_subtotal * (v_promo.discount_value / 100.00), 2);
        END IF;
    END IF;

    v_base_discounted_total := v_subtotal - v_first_order_discount - v_promo_discount;

    IF p_payment_method = 'cod' THEN
        v_cod_discount := round(v_base_discounted_total * 0.02, 2);
    END IF;

    v_final_payable := v_base_discounted_total - v_cod_discount;
    v_order_number := generate_order_number();

    INSERT INTO orders (
        order_number,
        customer_id,
        delivery_address_id,
        channel,
        order_status,
        payment_method,
        payment_status,
        minimum_order_amount_snapshot,
        subtotal_amount,
        first_order_discount,
        promo_discount,
        cod_discount,
        delivery_charge,
        final_payable_amount,
        total_cost_amount,
        placed_at,
        confirmed_at,
        is_before_cutoff,
        delivery_date,
        customer_name_snapshot,
        customer_mobile_snapshot,
        customer_alternate_mobile_snapshot,
        delivery_flat_house_snapshot,
        delivery_society_street_snapshot,
        delivery_landmark_snapshot,
        delivery_area_snapshot,
        delivery_city_snapshot,
        delivery_district_snapshot,
        delivery_pincode_snapshot,
        delivery_latitude_snapshot,
        delivery_longitude_snapshot,
        customer_snapshot_json,
        special_instructions
    ) VALUES (
        v_order_number,
        v_customer.id,
        v_address.id,
        p_channel,
        CASE WHEN p_payment_method = 'cod' THEN 'confirmed'::order_status_type ELSE 'payment_pending'::order_status_type END,
        p_payment_method,
        'pending',
        v_min_order,
        v_subtotal,
        v_first_order_discount,
        v_promo_discount,
        v_cod_discount,
        0.00,
        v_final_payable,
        v_total_cost,
        v_ist_now,
        CASE WHEN p_payment_method = 'cod' THEN v_ist_now ELSE NULL END,
        CASE WHEN p_payment_method = 'cod' THEN ((v_ist_now AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time) ELSE NULL END,
        CASE WHEN p_payment_method = 'cod' THEN 
            CASE WHEN (v_ist_now AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time 
                 THEN (v_ist_now AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day'
                 ELSE (v_ist_now AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '2 days'
            END
        ELSE NULL END,
        v_customer.full_name,
        v_customer.mobile,
        v_customer.alternate_mobile,
        v_address.flat_house_no,
        v_address.society_street_name,
        v_address.landmark,
        v_address.area_locality,
        v_address.city,
        v_address.district,
        v_address.pincode,
        v_address.latitude,
        v_address.longitude,
        to_jsonb(v_customer) || jsonb_build_object('address', to_jsonb(v_address)),
        p_special_instructions
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT 
            pv.id AS variant_id,
            pv.product_id,
            pv.unit_id,
            pv.variant_name_en,
            pv.variant_name_gu,
            pv.multiplier_to_base_unit,
            pv.selling_price,
            pv.current_estimated_cost,
            p.name_en AS product_name_en,
            p.name_gu AS product_name_gu,
            u.code AS unit_code
        INTO v_variant
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        JOIN product_units u ON pv.unit_id = u.id
        WHERE pv.id = (v_item->>'variant_id')::uuid;

        v_line_total := round(v_variant.selling_price * (v_item->>'quantity')::numeric, 2);
        v_line_cost := round(v_variant.current_estimated_cost * (v_item->>'quantity')::numeric, 2);

        INSERT INTO order_items (
            order_id,
            product_id,
            product_variant_id,
            unit_id,
            quantity,
            equivalent_base_qty,
            product_name_en_snapshot,
            product_name_gu_snapshot,
            variant_name_en_snapshot,
            variant_name_gu_snapshot,
            unit_code_snapshot,
            selling_price_snapshot,
            cost_price_snapshot,
            line_total,
            line_cost_total
        ) VALUES (
            v_order_id,
            v_variant.product_id,
            v_variant.variant_id,
            v_variant.unit_id,
            (v_item->>'quantity')::numeric,
            round((v_item->>'quantity')::numeric * v_variant.multiplier_to_base_unit, 3),
            v_variant.product_name_en,
            v_variant.product_name_gu,
            v_variant.variant_name_en,
            v_variant.variant_name_gu,
            v_variant.unit_code,
            v_variant.selling_price,
            v_variant.current_estimated_cost,
            v_line_total,
            v_line_cost
        );
    END LOOP;

    IF v_first_order_discount > 0 AND v_promo.id IS NOT NULL THEN
        INSERT INTO promotion_usage (
            promotion_id,
            customer_id,
            order_id,
            status,
            discount_amount_applied
        ) VALUES (
            v_promo.id,
            v_customer.id,
            v_order_id,
            CASE WHEN p_payment_method = 'cod' THEN 'consumed'::promo_usage_status_type ELSE 'reserved'::promo_usage_status_type END,
            v_first_order_discount
        );
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'first_order_discount', v_first_order_discount,
        'cod_discount', v_cod_discount,
        'final_payable_amount', v_final_payable,
        'order_status', CASE WHEN p_payment_method = 'cod' THEN 'confirmed' ELSE 'payment_pending' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Online Payment Confirmation RPC
CREATE OR REPLACE FUNCTION confirm_online_order(
    p_order_id UUID,
    p_gateway_captured_at TIMESTAMPTZ,
    p_gateway_provider VARCHAR(50),
    p_gateway_transaction_id VARCHAR(100),
    p_webhook_event_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_order RECORD;
    v_ist_time TIME;
    v_ist_date DATE;
    v_before_cutoff BOOLEAN;
    v_delivery_date DATE;
BEGIN
    SELECT * INTO v_order 
    FROM orders 
    WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order % not found.', p_order_id;
    END IF;

    IF v_order.order_status = 'confirmed' THEN
        RETURN;
    END IF;

    v_ist_time := (p_gateway_captured_at AT TIME ZONE 'Asia/Kolkata')::time;
    v_ist_date := (p_gateway_captured_at AT TIME ZONE 'Asia/Kolkata')::date;

    IF v_ist_time < '20:00:00'::time THEN
        v_before_cutoff := true;
        v_delivery_date := v_ist_date + INTERVAL '1 day';
    ELSE
        v_before_cutoff := false;
        v_delivery_date := v_ist_date + INTERVAL '2 days';
    END IF;

    UPDATE orders
    SET order_status = 'confirmed',
        payment_status = 'completed',
        confirmed_at = p_gateway_captured_at,
        is_before_cutoff = v_before_cutoff,
        delivery_date = v_delivery_date,
        updated_at = now()
    WHERE id = p_order_id;

    UPDATE promotion_usage
    SET status = 'consumed'
    WHERE order_id = p_order_id AND status = 'reserved';

    INSERT INTO payments (
        order_id,
        payment_method,
        amount,
        status,
        gateway_provider,
        gateway_transaction_id,
        webhook_event_id,
        collected_at
    ) VALUES (
        p_order_id,
        v_order.payment_method,
        v_order.final_payable_amount,
        'completed',
        p_gateway_provider,
        p_gateway_transaction_id,
        p_webhook_event_id,
        p_gateway_captured_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- =============================================================================
-- 14. ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_role(required_role staff_role_type)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (ur.role = required_role OR ur.role = 'owner')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE selling_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_batch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_purchase_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

REVOKE INSERT ON orders FROM authenticated, anon;
REVOKE INSERT ON order_items FROM authenticated, anon;

-- Staff Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (id = auth.uid() OR public.is_internal_staff());

DROP POLICY IF EXISTS "Owners can manage staff profiles" ON user_profiles;
CREATE POLICY "Owners can manage staff profiles" ON user_profiles
    FOR ALL USING (public.has_role('owner'));

DROP POLICY IF EXISTS "Owners can manage user roles" ON user_roles;
CREATE POLICY "Owners can manage user roles" ON user_roles
    FOR ALL USING (public.has_role('owner'));

-- Customer Profile & Addresses
DROP POLICY IF EXISTS "Customers view own profile" ON customers;
CREATE POLICY "Customers view own profile" ON customers
    FOR SELECT USING (auth_user_id = auth.uid() OR public.is_internal_staff());

DROP POLICY IF EXISTS "Customers update own safe profile fields" ON customers;
CREATE POLICY "Customers update own safe profile fields" ON customers
    FOR UPDATE USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers manage own addresses" ON customer_addresses;
CREATE POLICY "Customers manage own addresses" ON customer_addresses
    FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()) OR public.is_internal_staff());

-- Catalog & Variants
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
CREATE POLICY "Public can view active categories" ON categories
    FOR SELECT USING (is_active = true OR public.is_internal_staff());

DROP POLICY IF EXISTS "Public can view active units" ON product_units;
CREATE POLICY "Public can view active units" ON product_units
    FOR SELECT USING (is_active = true OR public.is_internal_staff());

DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products" ON products
    FOR SELECT USING (is_active = true OR public.is_internal_staff());

DROP POLICY IF EXISTS "Public can view active product variants" ON product_variants;
CREATE POLICY "Public can view active product variants" ON product_variants
    FOR SELECT USING (is_active = true OR public.is_internal_staff());

DROP POLICY IF EXISTS "Staff can manage catalog" ON products;
CREATE POLICY "Staff can manage catalog" ON products
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

DROP POLICY IF EXISTS "Staff can manage variants" ON product_variants;
CREATE POLICY "Staff can manage variants" ON product_variants
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

-- Supplier Pricing Privacy
DROP POLICY IF EXISTS "Supplier cost restricted to Owner and Manager" ON supplier_products;
CREATE POLICY "Supplier cost restricted to Owner and Manager" ON supplier_products
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

DROP POLICY IF EXISTS "Supplier cost history restricted" ON supplier_price_history;
CREATE POLICY "Supplier cost history restricted" ON supplier_price_history
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

DROP POLICY IF EXISTS "Suppliers managed by Manager and Owner" ON suppliers;
CREATE POLICY "Suppliers managed by Manager and Owner" ON suppliers
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

-- Orders & Line Items
DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers can view own order items" ON order_items;
CREATE POLICY "Customers can view own order items" ON order_items
    FOR SELECT USING (order_id IN (
        SELECT o.id FROM orders o 
        JOIN customers c ON o.customer_id = c.id 
        WHERE c.auth_user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Staff can view all orders" ON orders;
CREATE POLICY "Staff can view all orders" ON orders
    FOR SELECT USING (public.is_internal_staff());

DROP POLICY IF EXISTS "Staff can view all order items" ON order_items;
CREATE POLICY "Staff can view all order items" ON order_items
    FOR SELECT USING (public.is_internal_staff());

DROP POLICY IF EXISTS "Managers and Owners can update orders" ON orders;
CREATE POLICY "Managers and Owners can update orders" ON orders
    FOR UPDATE USING (public.has_role('manager') OR public.has_role('owner'));

-- Procurement Batches & Operations
DROP POLICY IF EXISTS "Procurement batches viewable by Staff" ON procurement_batches;
CREATE POLICY "Procurement batches viewable by Staff" ON procurement_batches
    FOR SELECT USING (public.is_internal_staff());

DROP POLICY IF EXISTS "Procurement batches managed by Manager and Owner" ON procurement_batches;
CREATE POLICY "Procurement batches managed by Manager and Owner" ON procurement_batches
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

DROP POLICY IF EXISTS "Procurement batch orders viewable by Staff" ON procurement_batch_orders;
CREATE POLICY "Procurement batch orders viewable by Staff" ON procurement_batch_orders
    FOR SELECT USING (public.is_internal_staff());

DROP POLICY IF EXISTS "Procurement purchase lines restricted to Manager and Owner" ON procurement_purchase_lines;
CREATE POLICY "Procurement purchase lines restricted to Manager and Owner" ON procurement_purchase_lines
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

-- Packing & Deliveries
DROP POLICY IF EXISTS "Packing staff can manage packing bags" ON packing_bags;
CREATE POLICY "Packing staff can manage packing bags" ON packing_bags
    FOR ALL USING (public.has_role('packing') OR public.has_role('manager') OR public.has_role('owner'));

DROP POLICY IF EXISTS "Delivery drivers view assigned batches" ON delivery_batches;
CREATE POLICY "Delivery drivers view assigned batches" ON delivery_batches
    FOR SELECT USING (driver_user_id = auth.uid() OR public.has_role('manager') OR public.has_role('owner'));

DROP POLICY IF EXISTS "Delivery drivers view and update assigned deliveries" ON deliveries;
CREATE POLICY "Delivery drivers view and update assigned deliveries" ON deliveries
    FOR ALL USING (driver_user_id = auth.uid() OR public.has_role('manager') OR public.has_role('owner'));

-- Payments
DROP POLICY IF EXISTS "Customers view own payment status" ON payments;
CREATE POLICY "Customers view own payment status" ON payments
    FOR SELECT USING (order_id IN (
        SELECT o.id FROM orders o 
        JOIN customers c ON o.customer_id = c.id 
        WHERE c.auth_user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Staff view payments" ON payments;
CREATE POLICY "Staff view payments" ON payments
    FOR SELECT USING (public.is_internal_staff());

DROP POLICY IF EXISTS "Delivery drivers can insert COD payments" ON payments;
CREATE POLICY "Delivery drivers can insert COD payments" ON payments
    FOR INSERT WITH CHECK (public.has_role('delivery') OR public.has_role('manager') OR public.has_role('owner'));

-- Complaints
DROP POLICY IF EXISTS "Customers manage own complaints" ON complaints;
CREATE POLICY "Customers manage own complaints" ON complaints
    FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff manage complaints" ON complaints;
CREATE POLICY "Staff manage complaints" ON complaints
    FOR ALL USING (public.is_internal_staff());

-- Audit Logs & App Settings
DROP POLICY IF EXISTS "Audit logs viewable only by Owner" ON audit_logs;
CREATE POLICY "Audit logs viewable only by Owner" ON audit_logs
    FOR SELECT USING (public.has_role('owner'));

DROP POLICY IF EXISTS "App settings readable by all" ON app_settings;
CREATE POLICY "App settings readable by all" ON app_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "App settings modifiable only by Owner" ON app_settings;
CREATE POLICY "App settings modifiable only by Owner" ON app_settings
    FOR ALL USING (public.has_role('owner'));


-- =============================================================================
-- 15. SEED DATA & INITIAL CONFIGURATION
-- =============================================================================

INSERT INTO app_settings (key, value, description) VALUES
(
    'min_order_amount',
    '{"amount": 200.00, "currency": "INR"}'::jsonb,
    'Minimum order subtotal before discounts required for checkout'
),
(
    'cutoff_time',
    '{"time": "20:00:00", "timezone": "Asia/Kolkata"}'::jsonb,
    'Daily order confirmation cutoff time for next-day delivery'
),
(
    'delivery_window',
    '{"start": "10:00:00", "end": "13:00:00", "timezone": "Asia/Kolkata"}'::jsonb,
    'Standard delivery time window'
),
(
    'cod_discount_pct',
    '{"percentage": 2.0, "is_active": true}'::jsonb,
    'Cash on Delivery discount percentage'
),
(
    'first_500_promo',
    '{"percentage": 10.0, "max_customer_sequence": 500, "is_active": true}'::jsonb,
    'First 500 verified customers promotion settings'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO product_units (code, name_en, name_gu, unit_type, is_active) VALUES
('kg', 'Kilogram', 'કિલોગ્રામ', 'weight', true),
('gram', 'Gram', 'ગ્રામ', 'weight', true),
('piece', 'Piece / Item', 'નંગ', 'count', true),
('bunch', 'Bunch / Bundle', 'પૂંજી/જુડી', 'bundle', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (slug, name_en, name_gu, display_order, is_active) VALUES
('daily-essentials', 'Daily Essentials', 'રોજિંદી શાકભાજી', 1, true),
('leafy-vegetables', 'Leafy Vegetables', 'ભાજી / પાંદડાવાળી શાકભાજી', 2, true),
('gourds-squashes', 'Gourds & Squashes', 'શાકભાજી / વેલાવાળા શાક', 3, true),
('root-tubers', 'Root & Tubers', 'કંદમૂળ / બટાટા-ડુંગળી', 4, true),
('exotic-herbs', 'Fresh Herbs & Seasoning', 'મસાલા / કોથમીર-આદુ-મરચાં', 5, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO promotions (
    promo_code,
    description,
    discount_type,
    discount_value,
    min_subtotal_amount,
    first_order_only,
    max_verified_customer_seq,
    is_active
) VALUES (
    'FIRST500',
    '10% OFF on first order for the first 500 verified customers in Halol',
    'percentage',
    10.00,
    200.00,
    true,
    500,
    true
)
ON CONFLICT (promo_code) DO NOTHING;
