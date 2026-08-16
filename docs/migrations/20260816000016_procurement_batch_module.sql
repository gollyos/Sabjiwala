-- =============================================================================
-- SABJIWALA: 8 PM PROCUREMENT BATCH + OWNER PROCUREMENT REPORT MODULE
-- =============================================================================

BEGIN;

-- 1. Table Alterations: Extend procurement tables with snapshot & buffer fields
ALTER TABLE procurement_items
    ADD COLUMN IF NOT EXISTS suggested_procurement_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS cancelled_after_lock_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.000;

ALTER TABLE procurement_batch_orders
    ADD COLUMN IF NOT EXISTS is_cancelled_post_lock BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cancelled_at_post_lock TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancellation_reason_post_lock TEXT,
    ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS override_reason TEXT,
    ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS final_payable_amount_snapshot NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS customer_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS area_locality_snapshot VARCHAR(255);

ALTER TABLE procurement_batches
    ADD COLUMN IF NOT EXISTS unique_customers_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gross_merchandise_total NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS first500_discounts_total NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS cod_discounts_total NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS expected_cod_collection_total NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(10, 3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS total_bunch_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_piece_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_products_count INT DEFAULT 0;

-- Indexes for high-performance cutoff queries and batch lookups
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status_confirmed ON orders(delivery_date, order_status, confirmed_at);
CREATE INDEX IF NOT EXISTS idx_proc_batch_orders_batch_id ON procurement_batch_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_proc_items_batch_id ON procurement_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_proc_purchase_lines_item_id ON procurement_purchase_lines(procurement_item_id);


-- 2. Seed App Settings for Procurement Buffer & Lock Webhook Secret
INSERT INTO app_settings (key, value, description)
VALUES 
    ('procurement_buffer_pct', '{"percentage": 3.0, "is_active": true}'::jsonb, 'Global default procurement buffer percentage added to customer demand'),
    ('procurement_lock_secret', '{"secret": "sabjiwala_procurement_lock_token_halol_2026"}'::jsonb, 'Authorization token for scheduled n8n procurement batch lock trigger')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;


-- 3. Seed Suppliers & Preferred Supplier Products in Halol APMC
INSERT INTO suppliers (id, supplier_code, name, contact_person, mobile, mandi_location, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111'::uuid, 'SUP-PATEL-01', 'Patel Vegetable Traders', 'Rameshbhai Patel', '+919825100001', 'Halol APMC Yard, Shop No. 12', true),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'SUP-KESHAV-02', 'Keshav Farm Produce', 'Keshavbhai Baria', '+919825100002', 'Vadodara Bypass APMC Mandi, Shed 4', true),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'SUP-DESAI-03', 'Desai Herbs & Greens', 'Pravin Desai', '+919825100003', 'Halol Main Mandi, Shop No. 5', true)
ON CONFLICT (id) DO NOTHING;

-- Map products to preferred suppliers with baseline mandi rates
DO $$
DECLARE
    v_prod RECORD;
BEGIN
    FOR v_prod IN SELECT id, slug FROM products
    LOOP
        IF v_prod.slug IN ('tomato', 'potato', 'onion', 'green-chillies') THEN
            INSERT INTO supplier_products (supplier_id, product_id, last_negotiated_cost_per_base_unit, is_preferred)
            VALUES ('11111111-1111-1111-1111-111111111111'::uuid, v_prod.id, 24.00, true)
            ON CONFLICT (supplier_id, product_id) DO NOTHING;
        ELSIF v_prod.slug IN ('bhindi', 'bottle-gourd', 'brinjal', 'cabbage', 'cauliflower', 'cucumber', 'capsicum') THEN
            INSERT INTO supplier_products (supplier_id, product_id, last_negotiated_cost_per_base_unit, is_preferred)
            VALUES ('22222222-2222-2222-2222-222222222222'::uuid, v_prod.id, 28.00, true)
            ON CONFLICT (supplier_id, product_id) DO NOTHING;
        ELSE
            INSERT INTO supplier_products (supplier_id, product_id, last_negotiated_cost_per_base_unit, is_preferred)
            VALUES ('33333333-3333-3333-3333-333333333333'::uuid, v_prod.id, 15.00, true)
            ON CONFLICT (supplier_id, product_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;


-- 4. Atomic 8 PM Procurement Batch Creation & Freeze Function
CREATE OR REPLACE FUNCTION lock_daily_procurement_batch(
    p_target_delivery_date DATE DEFAULT NULL,
    p_cutoff_timestamp TIMESTAMPTZ DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_now_ist TIMESTAMPTZ := now();
    v_target_date DATE;
    v_cutoff_ts TIMESTAMPTZ;
    v_batch_number VARCHAR(50);
    v_existing_batch RECORD;
    v_batch_id UUID;
    v_buffer_pct NUMERIC := 3.00;
    
    -- Aggregated order metrics
    v_eligible_orders_count INT := 0;
    v_unique_customers_count INT := 0;
    v_gross_merchandise NUMERIC(10, 2) := 0.00;
    v_first500_discounts NUMERIC(10, 2) := 0.00;
    v_cod_discounts NUMERIC(10, 2) := 0.00;
    v_expected_cod NUMERIC(10, 2) := 0.00;
    
    -- Unit breakdown
    v_weight_kg_total NUMERIC(10, 3) := 0.000;
    v_bunch_count_total INT := 0;
    v_piece_count_total INT := 0;
    v_products_count_total INT := 0;
    
    v_order_rec RECORD;
    v_item_rec RECORD;
BEGIN
    -- 1. Determine Target Delivery Date (Default: Tomorrow in Asia/Kolkata)
    IF p_target_delivery_date IS NOT NULL THEN
        v_target_date := p_target_delivery_date;
    ELSE
        v_target_date := (v_now_ist AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day';
    END IF;

    -- 2. Determine Strict Cutoff Timestamp (Default: 20:00:00 Asia/Kolkata of target_date - 1 day)
    IF p_cutoff_timestamp IS NOT NULL THEN
        v_cutoff_ts := p_cutoff_timestamp;
    ELSE
        v_cutoff_ts := ((v_target_date - INTERVAL '1 day')::text || ' 20:00:00+05:30')::timestamptz;
    END IF;

    v_batch_number := 'PB-' || to_char(v_target_date, 'YYYYMMDD') || '-HALOL';

    -- 3. Idempotency Check: If batch for target date already exists
    SELECT * INTO v_existing_batch
    FROM procurement_batches
    WHERE batch_date = v_target_date
    FOR UPDATE;

    IF v_existing_batch.id IS NOT NULL THEN
        -- Batch already locked or processed; return existing details safely without duplicate work
        RETURN jsonb_build_object(
            'success', true,
            'status', 'ALREADY_LOCKED',
            'is_idempotent_replay', true,
            'batch_id', v_existing_batch.id,
            'batch_number', v_existing_batch.batch_number,
            'batch_date', v_existing_batch.batch_date,
            'cutoff_timestamp', v_existing_batch.cutoff_timestamp,
            'total_orders_count', v_existing_batch.total_orders_count,
            'locked_at', v_existing_batch.locked_at,
            'message', format('Procurement batch %s for %s is already locked.', v_existing_batch.batch_number, v_existing_batch.batch_date)
        );
    END IF;

    -- 4. Load Configurable Buffer Percentage from app_settings
    SELECT COALESCE((value->>'percentage')::numeric, 3.00) INTO v_buffer_pct
    FROM app_settings
    WHERE key = 'procurement_buffer_pct' AND (value->>'is_active')::boolean = true;

    -- 5. Check Eligible Orders Count using STRICT '<' cutoff rule
    SELECT 
        COUNT(*),
        COUNT(DISTINCT customer_id),
        COALESCE(SUM(subtotal_amount), 0.00),
        COALESCE(SUM(first_order_discount), 0.00),
        COALESCE(SUM(cod_discount), 0.00),
        COALESCE(SUM(final_payable_amount), 0.00)
    INTO 
        v_eligible_orders_count,
        v_unique_customers_count,
        v_gross_merchandise,
        v_first500_discounts,
        v_cod_discounts,
        v_expected_cod
    FROM orders
    WHERE delivery_date = v_target_date
      AND order_status = 'confirmed'
      AND confirmed_at IS NOT NULL
      AND confirmed_at < v_cutoff_ts -- STRICT < 20:00:00 boundary
      AND NOT EXISTS (
          SELECT 1 FROM procurement_batch_orders pbo 
          WHERE pbo.order_id = orders.id
      );

    -- If zero eligible orders found, return NO_ELIGIBLE_ORDERS without corrupting batch table
    IF v_eligible_orders_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NO_ELIGIBLE_ORDERS',
            'target_delivery_date', v_target_date,
            'cutoff_timestamp', v_cutoff_ts,
            'message', format('No eligible confirmed orders found for delivery date %s before cutoff %s.', v_target_date, v_cutoff_ts)
        );
    END IF;

    -- 6. Insert Master Procurement Batch Record (Starts in 'locked' status)
    INSERT INTO procurement_batches (
        batch_number,
        batch_date,
        cutoff_timestamp,
        status,
        total_orders_count,
        unique_customers_count,
        gross_merchandise_total,
        first500_discounts_total,
        cod_discounts_total,
        expected_cod_collection_total,
        total_procurement_cost,
        total_received_weight_kg,
        total_usable_weight_kg,
        total_wastage_weight_kg,
        locked_at,
        locked_by
    ) VALUES (
        v_batch_number,
        v_target_date,
        v_cutoff_ts,
        'locked'::procurement_batch_status_type,
        v_eligible_orders_count,
        v_unique_customers_count,
        v_gross_merchandise,
        v_first500_discounts,
        v_cod_discounts,
        v_expected_cod,
        0.00,
        0.00,
        0.00,
        0.00,
        v_now_ist,
        p_actor_id
    ) RETURNING id INTO v_batch_id;

    -- 7. Freeze Order Membership into procurement_batch_orders
    FOR v_order_rec IN
        SELECT 
            o.id AS order_id,
            o.order_number,
            o.confirmed_at,
            o.final_payable_amount,
            o.customer_name_snapshot,
            o.delivery_area_snapshot,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
        FROM orders o
        WHERE o.delivery_date = v_target_date
          AND o.order_status = 'confirmed'
          AND o.confirmed_at IS NOT NULL
          AND o.confirmed_at < v_cutoff_ts
          AND NOT EXISTS (
              SELECT 1 FROM procurement_batch_orders pbo 
              WHERE pbo.order_id = o.id
          )
        FOR UPDATE OF o
    LOOP
        INSERT INTO procurement_batch_orders (
            batch_id,
            order_id,
            order_number_snapshot,
            order_confirmed_at_snapshot,
            order_item_count_snapshot,
            locked_into_batch_at,
            final_payable_amount_snapshot,
            customer_name_snapshot,
            area_locality_snapshot
        ) VALUES (
            v_batch_id,
            v_order_rec.order_id,
            v_order_rec.order_number,
            v_order_rec.confirmed_at,
            v_order_rec.items_count,
            v_now_ist,
            v_order_rec.final_payable_amount,
            v_order_rec.customer_name_snapshot,
            v_order_rec.delivery_area_snapshot
        );
    END LOOP;

    -- 8. Aggregate Product Demand from Frozen Batch Orders using equivalent_base_qty
    FOR v_item_rec IN
        SELECT 
            oi.product_id,
            p.base_unit_id,
            u.code AS unit_code,
            SUM(oi.equivalent_base_qty) AS total_customer_demand
        FROM order_items oi
        JOIN procurement_batch_orders pbo ON oi.order_id = pbo.order_id
        JOIN products p ON oi.product_id = p.id
        JOIN product_units u ON p.base_unit_id = u.id
        WHERE pbo.batch_id = v_batch_id
        GROUP BY oi.product_id, p.base_unit_id, u.code
    LOOP
        -- Calculate suggested purchase with buffer without mutating customer demand
        DECLARE
            v_req_qty NUMERIC(10, 3) := v_item_rec.total_customer_demand;
            v_sugg_qty NUMERIC(10, 3);
        BEGIN
            IF v_item_rec.unit_code = 'kg' THEN
                -- Weight products: Round up to nearest 0.5kg or 1.0kg with buffer
                v_sugg_qty := CEIL(v_req_qty * (1.0 + (v_buffer_pct / 100.0)) * 2.0) / 2.0;
                v_weight_kg_total := v_weight_kg_total + v_req_qty;
            ELSE
                -- Count / bunch products: Ceiling to whole integer with buffer
                v_sugg_qty := CEIL(v_req_qty * (1.0 + (v_buffer_pct / 100.0)));
                IF v_item_rec.unit_code IN ('bunch', 'bundle') THEN
                    v_bunch_count_total := v_bunch_count_total + v_req_qty::int;
                ELSE
                    v_piece_count_total := v_piece_count_total + v_req_qty::int;
                END IF;
            END IF;

            INSERT INTO procurement_items (
                batch_id,
                product_id,
                base_unit_id,
                required_qty,
                suggested_procurement_qty,
                procured_qty,
                received_qty,
                usable_qty,
                wastage_qty,
                total_procurement_cost,
                effective_cost_per_usable_unit,
                cancelled_after_lock_qty
            ) VALUES (
                v_batch_id,
                v_item_rec.product_id,
                v_item_rec.base_unit_id,
                v_req_qty,
                v_sugg_qty,
                0.000,
                0.000,
                0.000,
                0.000,
                0.00,
                NULL,
                0.000
            );

            v_products_count_total := v_products_count_total + 1;
        END;
    END LOOP;

    -- 9. Update Batch Summaries with Unit Breakdown
    UPDATE procurement_batches
    SET 
        total_weight_kg = v_weight_kg_total,
        total_bunch_count = v_bunch_count_total,
        total_piece_count = v_piece_count_total,
        total_products_count = v_products_count_total,
        updated_at = v_now_ist
    WHERE id = v_batch_id;

    -- 10. Audit Log Entry
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'procurement_batches',
        v_batch_id::text,
        'INSERT',
        jsonb_build_object(
            'event', 'PROCUREMENT_BATCH_LOCKED',
            'batch_number', v_batch_number,
            'batch_date', v_target_date,
            'cutoff_timestamp', v_cutoff_ts,
            'orders_count', v_eligible_orders_count,
            'customers_count', v_unique_customers_count,
            'products_count', v_products_count_total,
            'gross_merchandise', v_gross_merchandise,
            'expected_cod', v_expected_cod
        ),
        p_actor_id,
        'owner'
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'LOCKED',
        'is_idempotent_replay', false,
        'batch_id', v_batch_id,
        'batch_number', v_batch_number,
        'batch_date', v_target_date,
        'cutoff_timestamp', v_cutoff_ts,
        'total_orders_count', v_eligible_orders_count,
        'unique_customers_count', v_unique_customers_count,
        'gross_merchandise_total', v_gross_merchandise,
        'first500_discounts_total', v_first500_discounts,
        'cod_discounts_total', v_cod_discounts,
        'expected_cod_collection_total', v_expected_cod,
        'total_weight_kg', v_weight_kg_total,
        'total_bunch_count', v_bunch_count_total,
        'total_piece_count', v_piece_count_total,
        'total_products_count', v_products_count_total,
        'locked_at', v_now_ist
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION lock_daily_procurement_batch(DATE, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_daily_procurement_batch(DATE, TIMESTAMPTZ, UUID) TO authenticated, service_role;


-- 5. Comprehensive Procurement Batch Details & Reports Inspector RPC
CREATE OR REPLACE FUNCTION get_procurement_batch_details(
    p_batch_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_summary JSONB;
    v_products JSONB := '[]'::jsonb;
    v_orders JSONB := '[]'::jsonb;
    v_packing JSONB := '[]'::jsonb;
    v_exceptions JSONB := '[]'::jsonb;
    
    v_prod_rec RECORD;
    v_order_rec RECORD;
    v_pack_rec RECORD;
    v_exc_rec RECORD;
BEGIN
    SELECT * INTO v_batch 
    FROM procurement_batches 
    WHERE id = p_batch_id;

    IF v_batch.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Procurement batch not found.');
    END IF;

    -- Master Summary Object
    v_summary := jsonb_build_object(
        'batch_id', v_batch.id,
        'batch_number', v_batch.batch_number,
        'batch_date', v_batch.batch_date,
        'cutoff_timestamp', v_batch.cutoff_timestamp,
        'status', v_batch.status,
        'total_orders_count', v_batch.total_orders_count,
        'unique_customers_count', v_batch.unique_customers_count,
        'gross_merchandise_total', v_batch.gross_merchandise_total,
        'first500_discounts_total', v_batch.first500_discounts_total,
        'cod_discounts_total', v_batch.cod_discounts_total,
        'expected_cod_collection_total', v_batch.expected_cod_collection_total,
        'total_weight_kg', v_batch.total_weight_kg,
        'total_bunch_count', v_batch.total_bunch_count,
        'total_piece_count', v_batch.total_piece_count,
        'total_products_count', v_batch.total_products_count,
        'total_procurement_cost', v_batch.total_procurement_cost,
        'total_received_weight_kg', v_batch.total_received_weight_kg,
        'total_usable_weight_kg', v_batch.total_usable_weight_kg,
        'total_wastage_weight_kg', v_batch.total_wastage_weight_kg,
        'locked_at', v_batch.locked_at
    );

    -- Product Procurement Demand & Supplier Planning View
    FOR v_prod_rec IN
        SELECT 
            pi.id AS procurement_item_id,
            pi.product_id,
            p.name_en AS product_name_en,
            p.name_gu AS product_name_gu,
            p.image_url,
            c.name_en AS category_name_en,
            u.code AS base_unit_code,
            u.name_en AS base_unit_name_en,
            u.name_gu AS base_unit_name_gu,
            pi.required_qty,
            pi.suggested_procurement_qty,
            pi.cancelled_after_lock_qty,
            GREATEST(0.000, pi.suggested_procurement_qty - pi.cancelled_after_lock_qty) AS adjusted_operational_qty,
            pi.procured_qty,
            pi.received_qty,
            pi.usable_qty,
            pi.wastage_qty,
            pi.total_procurement_cost,
            pi.effective_cost_per_usable_unit,
            sp.supplier_id AS preferred_supplier_id,
            s.name AS preferred_supplier_name,
            s.mandi_location AS preferred_supplier_mandi,
            COALESCE(sp.last_negotiated_cost_per_base_unit, pv_cost.avg_cost, 0.00) AS latest_mandi_rate,
            ROUND(pi.suggested_procurement_qty * COALESCE(sp.last_negotiated_cost_per_base_unit, pv_cost.avg_cost, 0.00), 2) AS estimated_purchase_cost,
            (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', ppl.id,
                    'supplier_id', ppl.supplier_id,
                    'supplier_name', sup.name,
                    'purchased_qty', ppl.purchased_qty,
                    'rate_per_unit', ppl.rate_per_unit,
                    'total_cost', ppl.total_cost,
                    'mandi_lot_or_bill_no', ppl.mandi_lot_or_bill_no,
                    'purchased_at', ppl.purchased_at,
                    'notes', ppl.notes
                )), '[]'::jsonb)
                FROM procurement_purchase_lines ppl
                LEFT JOIN suppliers sup ON ppl.supplier_id = sup.id
                WHERE ppl.procurement_item_id = pi.id
            ) AS purchase_lines
        FROM procurement_items pi
        JOIN products p ON pi.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN product_units u ON pi.base_unit_id = u.id
        LEFT JOIN LATERAL (
            SELECT supplier_id, last_negotiated_cost_per_base_unit 
            FROM supplier_products 
            WHERE product_id = p.id AND is_preferred = true 
            LIMIT 1
        ) sp ON true
        LEFT JOIN suppliers s ON sp.supplier_id = s.id
        LEFT JOIN LATERAL (
            SELECT AVG(current_estimated_cost) AS avg_cost
            FROM product_variants 
            WHERE product_id = p.id
        ) pv_cost ON true
        WHERE pi.batch_id = p_batch_id
        ORDER BY c.display_order ASC, p.name_en ASC
    LOOP
        v_products := v_products || to_jsonb(v_prod_rec);
    END LOOP;

    -- Frozen Order Membership
    FOR v_order_rec IN
        SELECT 
            pbo.id AS membership_id,
            pbo.order_id,
            pbo.order_number_snapshot AS order_number,
            pbo.order_confirmed_at_snapshot AS confirmed_at,
            pbo.order_item_count_snapshot AS item_count,
            pbo.final_payable_amount_snapshot AS final_payable_amount,
            pbo.customer_name_snapshot AS customer_name,
            pbo.area_locality_snapshot AS area_locality,
            pbo.is_cancelled_post_lock,
            pbo.cancelled_at_post_lock,
            pbo.cancellation_reason_post_lock,
            pbo.is_manual_override,
            pbo.override_reason,
            o.order_status,
            o.payment_status
        FROM procurement_batch_orders pbo
        JOIN orders o ON pbo.order_id = o.id
        WHERE pbo.batch_id = p_batch_id
        ORDER BY pbo.order_number_snapshot ASC
    LOOP
        v_orders := v_orders || to_jsonb(v_order_rec);
        
        IF v_order_rec.is_cancelled_post_lock OR v_order_rec.is_manual_override THEN
            v_exceptions := v_exceptions || to_jsonb(v_order_rec);
        END IF;
    END LOOP;

    -- Packing Preparation Summary (Order-wise items breakdown)
    FOR v_pack_rec IN
        SELECT 
            pbo.order_id,
            pbo.order_number_snapshot AS order_number,
            pbo.customer_name_snapshot AS customer_name,
            pbo.area_locality_snapshot AS area_locality,
            pbo.final_payable_amount_snapshot AS final_payable_amount,
            pbo.is_cancelled_post_lock,
            (
                SELECT jsonb_agg(jsonb_build_object(
                    'product_name_en', oi.product_name_en_snapshot,
                    'product_name_gu', oi.product_name_gu_snapshot,
                    'variant_name_en', oi.variant_name_en_snapshot,
                    'variant_name_gu', oi.variant_name_gu_snapshot,
                    'quantity', oi.quantity,
                    'unit_code', oi.unit_code_snapshot,
                    'line_total', oi.line_total
                ))
                FROM order_items oi
                WHERE oi.order_id = pbo.order_id
            ) AS items
        FROM procurement_batch_orders pbo
        WHERE pbo.batch_id = p_batch_id AND NOT pbo.is_cancelled_post_lock
        ORDER BY pbo.order_number_snapshot ASC
    LOOP
        v_packing := v_packing || to_jsonb(v_pack_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'summary', v_summary,
        'products', v_products,
        'orders', v_orders,
        'packing_queue', v_packing,
        'exceptions', v_exceptions
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_procurement_batch_details(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_procurement_batch_details(UUID) TO authenticated, service_role;


-- 6. Supplier Purchase Entry RPC (Supports multi-supplier purchase lines)
CREATE OR REPLACE FUNCTION record_procurement_purchase_line(
    p_procurement_item_id UUID,
    p_supplier_id UUID,
    p_purchased_qty NUMERIC,
    p_rate_per_unit NUMERIC,
    p_mandi_lot_or_bill_no VARCHAR(100) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_purchased_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_line_id UUID;
    v_total_cost NUMERIC(10, 2);
    v_tot_purchased_qty NUMERIC(10, 3);
    v_tot_item_cost NUMERIC(10, 2);
    v_batch_total_cost NUMERIC(10, 2);
BEGIN
    IF p_purchased_qty <= 0 OR p_rate_per_unit < 0 THEN
        RAISE EXCEPTION 'INVALID_PURCHASE_VALUES: Quantity must be > 0 and rate >= 0.' USING ERRCODE = 'P0020';
    END IF;

    SELECT * INTO v_item 
    FROM procurement_items 
    WHERE id = p_procurement_item_id 
    FOR UPDATE;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'PROCUREMENT_ITEM_NOT_FOUND: Item % does not exist.', p_procurement_item_id USING ERRCODE = 'P0021';
    END IF;

    v_total_cost := ROUND(p_purchased_qty * p_rate_per_unit, 2);

    -- Insert Purchase Line
    INSERT INTO procurement_purchase_lines (
        procurement_item_id,
        supplier_id,
        purchased_qty,
        rate_per_unit,
        total_cost,
        mandi_lot_or_bill_no,
        purchased_at,
        purchased_by,
        notes
    ) VALUES (
        p_procurement_item_id,
        p_supplier_id,
        p_purchased_qty,
        p_rate_per_unit,
        v_total_cost,
        p_mandi_lot_or_bill_no,
        now(),
        p_purchased_by,
        p_notes
    ) RETURNING id INTO v_line_id;

    -- Recalculate totals for procurement_item
    SELECT 
        COALESCE(SUM(purchased_qty), 0.000),
        COALESCE(SUM(total_cost), 0.00)
    INTO v_tot_purchased_qty, v_tot_item_cost
    FROM procurement_purchase_lines
    WHERE procurement_item_id = p_procurement_item_id;

    UPDATE procurement_items
    SET 
        procured_qty = v_tot_purchased_qty,
        total_procurement_cost = v_tot_item_cost,
        effective_cost_per_usable_unit = CASE WHEN usable_qty > 0 THEN ROUND(v_tot_item_cost / usable_qty, 2) ELSE NULL END
    WHERE id = p_procurement_item_id;

    -- Recalculate Master Batch Total Procurement Cost
    SELECT COALESCE(SUM(total_procurement_cost), 0.00) INTO v_batch_total_cost
    FROM procurement_items
    WHERE batch_id = v_item.batch_id;

    UPDATE procurement_batches
    SET 
        total_procurement_cost = v_batch_total_cost,
        status = 'procured'::procurement_batch_status_type,
        updated_at = now()
    WHERE id = v_item.batch_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'procurement_purchase_lines',
        v_line_id::text,
        'INSERT',
        jsonb_build_object(
            'procurement_item_id', p_procurement_item_id,
            'supplier_id', p_supplier_id,
            'purchased_qty', p_purchased_qty,
            'rate_per_unit', p_rate_per_unit,
            'total_cost', v_total_cost
        ),
        p_purchased_by,
        'owner'
    );

    RETURN jsonb_build_object(
        'success', true,
        'purchase_line_id', v_line_id,
        'total_procured_qty', v_tot_purchased_qty,
        'total_item_cost', v_tot_item_cost,
        'batch_total_cost', v_batch_total_cost
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION record_procurement_purchase_line(UUID, UUID, NUMERIC, NUMERIC, VARCHAR, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_procurement_purchase_line(UUID, UUID, NUMERIC, NUMERIC, VARCHAR, TEXT, UUID) TO authenticated, service_role;


-- 7. Receiving & Wastage Recording RPC
CREATE OR REPLACE FUNCTION record_procurement_receiving_and_wastage(
    p_procurement_item_id UUID,
    p_received_qty NUMERIC,
    p_usable_qty NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_wastage NUMERIC(10, 3);
    v_eff_cost NUMERIC(10, 2);
    v_tot_received_kg NUMERIC(10, 3);
    v_tot_usable_kg NUMERIC(10, 3);
    v_tot_wastage_kg NUMERIC(10, 3);
BEGIN
    IF p_received_qty < 0 OR p_usable_qty < 0 OR p_usable_qty > p_received_qty THEN
        RAISE EXCEPTION 'INVALID_RECEIVING_VALUES: Usable quantity cannot exceed received quantity.' USING ERRCODE = 'P0022';
    END IF;

    SELECT * INTO v_item 
    FROM procurement_items 
    WHERE id = p_procurement_item_id 
    FOR UPDATE;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'PROCUREMENT_ITEM_NOT_FOUND: Item not found.' USING ERRCODE = 'P0023';
    END IF;

    v_wastage := ROUND(p_received_qty - p_usable_qty, 3);
    IF p_usable_qty > 0 THEN
        v_eff_cost := ROUND(v_item.total_procurement_cost / p_usable_qty, 2);
    ELSE
        v_eff_cost := NULL;
    END IF;

    UPDATE procurement_items
    SET 
        received_qty = p_received_qty,
        usable_qty = p_usable_qty,
        wastage_qty = v_wastage,
        effective_cost_per_usable_unit = v_eff_cost,
        notes = p_notes
    WHERE id = p_procurement_item_id;

    -- Update batch weight aggregates for kg products
    SELECT 
        COALESCE(SUM(pi.received_qty), 0.000),
        COALESCE(SUM(pi.usable_qty), 0.000),
        COALESCE(SUM(pi.wastage_qty), 0.000)
    INTO v_tot_received_kg, v_tot_usable_kg, v_tot_wastage_kg
    FROM procurement_items pi
    JOIN product_units u ON pi.base_unit_id = u.id
    WHERE pi.batch_id = v_item.batch_id AND u.code = 'kg';

    UPDATE procurement_batches
    SET 
        total_received_weight_kg = v_tot_received_kg,
        total_usable_weight_kg = v_tot_usable_kg,
        total_wastage_weight_kg = v_tot_wastage_kg,
        updated_at = now()
    WHERE id = v_item.batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'received_qty', p_received_qty,
        'usable_qty', p_usable_qty,
        'wastage_qty', v_wastage,
        'effective_cost_per_usable_unit', v_eff_cost
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION record_procurement_receiving_and_wastage(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_procurement_receiving_and_wastage(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;


-- 8. Post-Lock Order Cancellation Handler (Preserves batch history & tracks operational exceptions)
CREATE OR REPLACE FUNCTION handle_post_lock_order_cancellation(
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by Customer/Owner after batch lock'
)
RETURNS JSONB AS $$
DECLARE
    v_pbo RECORD;
    v_order RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_pbo 
    FROM procurement_batch_orders 
    WHERE order_id = p_order_id 
    FOR UPDATE;

    SELECT * INTO v_order 
    FROM orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found.');
    END IF;

    -- Update Order Status
    UPDATE orders
    SET 
        order_status = 'cancelled'::order_status_type,
        cancellation_reason = p_reason,
        cancelled_at = now(),
        updated_at = now()
    WHERE id = p_order_id;

    -- Release promotion reservation if any
    UPDATE promotion_usage
    SET status = 'released'::promo_usage_status_type, released_at = now(), release_reason = p_reason
    WHERE order_id = p_order_id AND status = 'reserved';

    -- If order belongs to a locked batch, flag exception in membership table without deleting history
    IF v_pbo.id IS NOT NULL THEN
        UPDATE procurement_batch_orders
        SET 
            is_cancelled_post_lock = true,
            cancelled_at_post_lock = now(),
            cancellation_reason_post_lock = p_reason
        WHERE id = v_pbo.id;

        -- Update cancelled demand in procurement_items for operational awareness
        FOR v_item IN 
            SELECT oi.product_id, SUM(oi.equivalent_base_qty) AS cancelled_qty
            FROM order_items oi
            WHERE oi.order_id = p_order_id
            GROUP BY oi.product_id
        LOOP
            UPDATE procurement_items
            SET cancelled_after_lock_qty = cancelled_after_lock_qty + v_item.cancelled_qty
            WHERE batch_id = v_pbo.batch_id AND product_id = v_item.product_id;
        END LOOP;

        -- Audit Log
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            new_data,
            actor_user_id,
            actor_role
        ) VALUES (
            'procurement_batch_orders',
            v_pbo.id::text,
            'INSERT',
            jsonb_build_object(
                'event', 'POST_LOCK_ORDER_CANCELLED',
                'order_id', p_order_id,
                'batch_id', v_pbo.batch_id,
                'reason', p_reason
            ),
            auth.uid(),
            'owner'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'is_in_procurement_batch', (v_pbo.id IS NOT NULL),
        'batch_id', v_pbo.batch_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION handle_post_lock_order_cancellation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_post_lock_order_cancellation(UUID, TEXT) TO authenticated, service_role;


-- 9. Owner Manual Override for Late Orders
CREATE OR REPLACE FUNCTION add_late_order_manual_override(
    p_order_id UUID,
    p_batch_id UUID,
    p_reason TEXT,
    p_override_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_order RECORD;
    v_pbo_id UUID;
    v_item RECORD;
BEGIN
    SELECT * INTO v_batch FROM procurement_batches WHERE id = p_batch_id FOR UPDATE;
    IF v_batch.id IS NULL THEN
        RAISE EXCEPTION 'BATCH_NOT_FOUND: Procurement batch does not exist.' USING ERRCODE = 'P0024';
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order does not exist.' USING ERRCODE = 'P0025';
    END IF;

    IF EXISTS (SELECT 1 FROM procurement_batch_orders WHERE order_id = p_order_id) THEN
        RAISE EXCEPTION 'ORDER_ALREADY_IN_BATCH: Order is already assigned to a batch.' USING ERRCODE = 'P0026';
    END IF;

    -- Insert into batch orders with override flag
    INSERT INTO procurement_batch_orders (
        batch_id,
        order_id,
        order_number_snapshot,
        order_confirmed_at_snapshot,
        order_item_count_snapshot,
        locked_into_batch_at,
        is_manual_override,
        override_reason,
        override_by,
        final_payable_amount_snapshot,
        customer_name_snapshot,
        area_locality_snapshot
    ) VALUES (
        v_batch.id,
        v_order.id,
        v_order.order_number,
        v_order.confirmed_at,
        (SELECT COUNT(*) FROM order_items WHERE order_id = v_order.id),
        now(),
        true,
        p_reason,
        p_override_by,
        v_order.final_payable_amount,
        v_order.customer_name_snapshot,
        v_order.delivery_area_snapshot
    ) RETURNING id INTO v_pbo_id;

    -- Update batch totals
    UPDATE procurement_batches
    SET 
        total_orders_count = total_orders_count + 1,
        gross_merchandise_total = gross_merchandise_total + v_order.subtotal_amount,
        first500_discounts_total = first500_discounts_total + v_order.first_order_discount,
        cod_discounts_total = cod_discounts_total + v_order.cod_discount,
        expected_cod_collection_total = expected_cod_collection_total + v_order.final_payable_amount,
        updated_at = now()
    WHERE id = v_batch.id;

    -- Adjust product demands in procurement_items
    FOR v_item IN
        SELECT oi.product_id, p.base_unit_id, SUM(oi.equivalent_base_qty) AS qty
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = v_order.id
        GROUP BY oi.product_id, p.base_unit_id
    LOOP
        INSERT INTO procurement_items (
            batch_id, product_id, base_unit_id, required_qty, suggested_procurement_qty
        ) VALUES (
            v_batch.id, v_item.product_id, v_item.base_unit_id, v_item.qty, v_item.qty
        )
        ON CONFLICT (batch_id, product_id) DO UPDATE
        SET 
            required_qty = procurement_items.required_qty + EXCLUDED.required_qty,
            suggested_procurement_qty = procurement_items.suggested_procurement_qty + EXCLUDED.suggested_procurement_qty;
    END LOOP;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'procurement_batch_orders',
        v_pbo_id::text,
        'INSERT',
        jsonb_build_object(
            'event', 'MANUAL_LATE_ORDER_OVERRIDE_ADDED',
            'order_id', p_order_id,
            'batch_id', p_batch_id,
            'reason', p_reason
        ),
        p_override_by,
        'owner'
    );

    RETURN jsonb_build_object(
        'success', true,
        'membership_id', v_pbo_id,
        'batch_id', p_batch_id,
        'order_number', v_order.order_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION add_late_order_manual_override(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_late_order_manual_override(UUID, UUID, TEXT, UUID) TO authenticated, service_role;

COMMIT;
