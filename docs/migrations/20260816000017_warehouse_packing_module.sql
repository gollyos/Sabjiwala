-- =============================================================================
-- SABJIWALA: WAREHOUSE PACKING + BAG STICKER + THERMAL PRINTER MODULE
-- =============================================================================

BEGIN;

-- 1. Table Alterations: Extend orders, order_items, and packing_bags
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS packing_status VARCHAR(30) NOT NULL DEFAULT 'waiting',
    ADD COLUMN IF NOT EXISTS packing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS packing_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS packed_by_user_id UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS packed_by_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS packing_device_session VARCHAR(100),
    ADD COLUMN IF NOT EXISTS packing_problem_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS packing_problem_notes TEXT,
    ADD COLUMN IF NOT EXISTS packing_problem_reported_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS packing_problem_reported_by UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS packing_problem_resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS packing_problem_resolved_by UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS packing_problem_resolution_notes TEXT,
    ADD COLUMN IF NOT EXISTS total_bags_count INT NOT NULL DEFAULT 1;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS is_packed_confirmed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS packed_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS packed_confirmed_by UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS packing_notes TEXT;

ALTER TABLE packing_bags
    ADD COLUMN IF NOT EXISTS total_bags_snapshot INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS qr_token VARCHAR(100) UNIQUE,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS print_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_printed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reprint_count INT NOT NULL DEFAULT 0;

-- Ensure constraint uq_order_bag_sequence exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_order_bag_sequence'
    ) THEN
        ALTER TABLE packing_bags ADD CONSTRAINT uq_order_bag_sequence UNIQUE (order_id, bag_sequence);
    END IF;
END $$;


-- 2. Print Jobs Table
CREATE TABLE IF NOT EXISTS print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL DEFAULT 'bag_sticker',
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    packing_bag_id UUID REFERENCES packing_bags(id) ON DELETE SET NULL,
    printer_target VARCHAR(50) NOT NULL DEFAULT 'browser',
    label_size VARCHAR(20) NOT NULL DEFAULT '100x150',
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'queued',
    requested_by UUID REFERENCES user_profiles(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    printed_at TIMESTAMPTZ,
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    is_reprint BOOLEAN NOT NULL DEFAULT false,
    reprint_reason VARCHAR(100),
    idempotency_key VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_bag ON print_jobs(packing_bag_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_idempotency ON print_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;


-- 3. App Settings for Printer Configuration
INSERT INTO app_settings (key, value, description)
VALUES 
    ('printer_settings', '{
        "printer_enabled": true,
        "printer_target": "browser",
        "location_name": "Halol Godown Pack Station 1",
        "label_size": "100x150",
        "show_product_summary": true,
        "auto_print_on_pack": false,
        "copies_per_bag": 1
    }'::jsonb, 'Global warehouse thermal printer and bag sticker configuration')
ON CONFLICT (key) DO NOTHING;


-- 4. RPC: Start Order Packing with Concurrency Protection
CREATE OR REPLACE FUNCTION start_order_packing(
    p_order_id UUID,
    p_staff_user_id UUID DEFAULT NULL,
    p_staff_name VARCHAR DEFAULT 'Staff',
    p_device_session VARCHAR DEFAULT NULL,
    p_force_override BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_now TIMESTAMPTZ := now();
    v_bag RECORD;
BEGIN
    SELECT * INTO v_order 
    FROM orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    IF v_order.order_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_CANCELLED', 'message', 'Cannot pack a cancelled order.');
    END IF;

    -- Concurrency collision check: If another staff started packing in last 30 mins
    IF v_order.packing_status = 'packing' 
       AND v_order.packed_by_user_id IS NOT NULL 
       AND v_order.packed_by_user_id <> p_staff_user_id 
       AND (v_order.packing_started_at > v_now - INTERVAL '30 minutes')
       AND NOT p_force_override 
    THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ORDER_LOCKED_BY_OTHER',
            'current_packer_name', COALESCE(v_order.packed_by_name, 'Another Staff'),
            'current_packer_id', v_order.packed_by_user_id,
            'started_at', v_order.packing_started_at,
            'message', format('This order is currently being packed by %s.', COALESCE(v_order.packed_by_name, 'another worker'))
        );
    END IF;

    -- Initialize Bag 1 if no bags exist
    SELECT * INTO v_bag FROM packing_bags WHERE order_id = p_order_id AND bag_sequence = 1;
    IF v_bag.id IS NULL THEN
        INSERT INTO packing_bags (
            order_id,
            bag_barcode,
            bag_sequence,
            total_bags_snapshot,
            qr_token,
            packed_by_user_id,
            packed_at
        ) VALUES (
            p_order_id,
            v_order.order_number || '-B01',
            1,
            v_order.total_bags_count,
            'BAG-' || replace(gen_random_uuid()::text, '-', ''),
            p_staff_user_id,
            v_now
        );
    END IF;

    -- Update Order Packing Status
    UPDATE orders
    SET 
        packing_status = CASE WHEN packing_status IN ('waiting', 'problem') THEN 'packing' ELSE packing_status END,
        packing_started_at = COALESCE(packing_started_at, v_now),
        packed_by_user_id = p_staff_user_id,
        packed_by_name = p_staff_name,
        packing_device_session = p_device_session,
        updated_at = v_now
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        p_order_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'PACKING_STARTED',
            'order_number', v_order.order_number,
            'packed_by_name', p_staff_name,
            'is_force_override', p_force_override
        ),
        p_staff_user_id,
        'packing'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order.order_number,
        'packing_status', 'packing',
        'packed_by_name', p_staff_name,
        'total_bags_count', v_order.total_bags_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION start_order_packing(UUID, UUID, VARCHAR, VARCHAR, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_order_packing(UUID, UUID, VARCHAR, VARCHAR, BOOLEAN) TO authenticated, service_role;


-- 5. RPC: Update Order Item Packed Checklist & Weight
CREATE OR REPLACE FUNCTION update_order_item_packed_status(
    p_order_item_id UUID,
    p_packed_quantity NUMERIC,
    p_is_confirmed BOOLEAN DEFAULT true,
    p_notes TEXT DEFAULT NULL,
    p_staff_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_order RECORD;
    v_now TIMESTAMPTZ := now();
    v_weight_diff NUMERIC;
BEGIN
    SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id FOR UPDATE;
    IF v_item.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ITEM_NOT_FOUND', 'message', 'Order item not found.');
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_item.order_id FOR UPDATE;

    IF v_order.order_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_CANCELLED', 'message', 'Cannot pack cancelled order.');
    END IF;

    v_weight_diff := ABS(COALESCE(p_packed_quantity, v_item.quantity) - v_item.quantity);

    UPDATE order_items
    SET 
        packed_quantity = COALESCE(p_packed_quantity, quantity),
        is_packed_confirmed = p_is_confirmed,
        packed_confirmed_at = CASE WHEN p_is_confirmed THEN v_now ELSE NULL END,
        packed_confirmed_by = CASE WHEN p_is_confirmed THEN p_staff_user_id ELSE NULL END,
        packing_notes = p_notes
    WHERE id = p_order_item_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_item_id', p_order_item_id,
        'ordered_quantity', v_item.quantity,
        'packed_quantity', COALESCE(p_packed_quantity, v_item.quantity),
        'is_packed_confirmed', p_is_confirmed,
        'weight_diff', v_weight_diff
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION update_order_item_packed_status(UUID, NUMERIC, BOOLEAN, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_order_item_packed_status(UUID, NUMERIC, BOOLEAN, TEXT, UUID) TO authenticated, service_role;


-- 6. RPC: Report & Resolve Packing Problems
CREATE OR REPLACE FUNCTION report_order_packing_problem(
    p_order_id UUID,
    p_problem_type VARCHAR,
    p_notes TEXT,
    p_staff_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    UPDATE orders
    SET 
        packing_status = 'problem',
        packing_problem_type = p_problem_type,
        packing_problem_notes = p_notes,
        packing_problem_reported_at = v_now,
        packing_problem_reported_by = p_staff_user_id,
        updated_at = v_now
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        p_order_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'PACKING_PROBLEM_REPORTED',
            'order_number', v_order.order_number,
            'problem_type', p_problem_type,
            'notes', p_notes
        ),
        p_staff_user_id,
        'packing'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'packing_status', 'problem',
        'problem_type', p_problem_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION report_order_packing_problem(UUID, VARCHAR, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION report_order_packing_problem(UUID, VARCHAR, TEXT, UUID) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION resolve_order_packing_problem(
    p_order_id UUID,
    p_resolution_notes TEXT,
    p_resolved_status VARCHAR DEFAULT 'packing',
    p_manager_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    UPDATE orders
    SET 
        packing_status = p_resolved_status,
        packing_problem_resolved_at = v_now,
        packing_problem_resolved_by = p_manager_user_id,
        packing_problem_resolution_notes = p_resolution_notes,
        updated_at = v_now
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        p_order_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'PACKING_PROBLEM_RESOLVED',
            'order_number', v_order.order_number,
            'resolved_status', p_resolved_status,
            'resolution_notes', p_resolution_notes
        ),
        p_manager_user_id,
        'manager'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'packing_status', p_resolved_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION resolve_order_packing_problem(UUID, TEXT, VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_order_packing_problem(UUID, TEXT, VARCHAR, UUID) TO authenticated, service_role;


-- 7. RPC: Set Order Bag Count (Multi-Bag Management)
CREATE OR REPLACE FUNCTION set_order_bag_count(
    p_order_id UUID,
    p_bag_count INT,
    p_staff_user_id UUID DEFAULT NULL,
    p_is_manager_override BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_current_count INT;
    v_seq INT;
    v_barcode VARCHAR(50);
    v_now TIMESTAMPTZ := now();
BEGIN
    IF p_bag_count < 1 OR p_bag_count > 20 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_BAG_COUNT', 'message', 'Bag count must be between 1 and 20.');
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    -- If order already verified/packed, require manager override
    IF v_order.packing_status IN ('verified', 'packed') AND NOT p_is_manager_override THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error_code', 'VERIFIED_ORDER_OVERRIDE_REQUIRED', 
            'message', 'Order is already verified. Changing bag count requires Manager override.'
        );
    END IF;

    -- Current bag count
    SELECT COUNT(*) INTO v_current_count FROM packing_bags WHERE order_id = p_order_id;

    -- If increasing, insert missing bags
    IF p_bag_count > v_current_count THEN
        FOR v_seq IN (v_current_count + 1) .. p_bag_count LOOP
            v_barcode := v_order.order_number || '-B' || lpad(v_seq::text, 2, '0');
            INSERT INTO packing_bags (
                order_id,
                bag_barcode,
                bag_sequence,
                total_bags_snapshot,
                qr_token,
                packed_by_user_id,
                packed_at,
                is_verified
            ) VALUES (
                p_order_id,
                v_barcode,
                v_seq,
                p_bag_count,
                'BAG-' || replace(gen_random_uuid()::text, '-', ''),
                p_staff_user_id,
                v_now,
                false
            )
            ON CONFLICT (order_id, bag_sequence) DO UPDATE
            SET total_bags_snapshot = p_bag_count, is_verified = false;
        END LOOP;
    ELSIF p_bag_count < v_current_count THEN
        -- Delete excess unneeded bags
        DELETE FROM packing_bags
        WHERE order_id = p_order_id AND bag_sequence > p_bag_count;
    END IF;

    -- Update total_bags_snapshot and reset verification if bag count changed
    UPDATE packing_bags
    SET 
        total_bags_snapshot = p_bag_count,
        is_verified = false,
        verified_at = NULL,
        verified_by_user_id = NULL
    WHERE order_id = p_order_id;

    -- Update order bag count
    UPDATE orders
    SET 
        total_bags_count = p_bag_count,
        packing_status = CASE WHEN packing_status = 'verified' THEN 'packed' ELSE packing_status END,
        updated_at = v_now
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'packing_bags',
        p_order_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'BAG_COUNT_UPDATED',
            'order_number', v_order.order_number,
            'old_count', v_current_count,
            'new_count', p_bag_count,
            'is_manager_override', p_is_manager_override
        ),
        p_staff_user_id,
        'packing'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'total_bags_count', p_bag_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION set_order_bag_count(UUID, INT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_order_bag_count(UUID, INT, UUID, BOOLEAN) TO authenticated, service_role;


-- 8. RPC: Queue Bag Sticker Print Job (Authoritative Payload + Debounce)
CREATE OR REPLACE FUNCTION queue_bag_sticker_print_job(
    p_order_id UUID,
    p_bag_id UUID DEFAULT NULL,
    p_is_reprint BOOLEAN DEFAULT false,
    p_reprint_reason VARCHAR DEFAULT NULL,
    p_requested_by UUID DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_bag RECORD;
    v_settings RECORD;
    v_items_json JSONB;
    v_payload JSONB;
    v_job_id UUID;
    v_masked_phone VARCHAR(20);
    v_now TIMESTAMPTZ := now();
    v_existing_job RECORD;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    -- Debounce check with idempotency key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_job 
        FROM print_jobs 
        WHERE idempotency_key = p_idempotency_key 
          AND requested_at > v_now - INTERVAL '3 seconds';

        IF v_existing_job.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_debounced', true,
                'print_job_id', v_existing_job.id,
                'payload', v_existing_job.payload
            );
        END IF;
    END IF;

    -- Load printer settings
    SELECT value INTO v_settings FROM app_settings WHERE key = 'printer_settings';

    -- Format Masked Phone Number: e.g. ******4582
    IF length(v_order.customer_mobile_snapshot) >= 10 THEN
        v_masked_phone := '******' || right(v_order.customer_mobile_snapshot, 4);
    ELSE
        v_masked_phone := v_order.customer_mobile_snapshot;
    END IF;

    -- Compact item summary for label
    SELECT jsonb_agg(jsonb_build_object(
        'name_en', oi.product_name_en_snapshot,
        'name_gu', oi.product_name_gu_snapshot,
        'variant_en', oi.variant_name_en_snapshot,
        'variant_gu', oi.variant_name_gu_snapshot,
        'qty', oi.quantity,
        'unit', oi.unit_code_snapshot
    )) INTO v_items_json
    FROM order_items oi
    WHERE oi.order_id = p_order_id;

    -- If p_bag_id provided, generate for single bag; otherwise generate for all bags of order
    FOR v_bag IN 
        SELECT * FROM packing_bags 
        WHERE order_id = p_order_id AND (p_bag_id IS NULL OR id = p_bag_id)
        ORDER BY bag_sequence ASC
    LOOP
        v_payload := jsonb_build_object(
            'header', 'SABJIWALA',
            'order_id', v_order.id,
            'order_number', v_order.order_number,
            'bag_id', v_bag.id,
            'bag_barcode', v_bag.bag_barcode,
            'bag_sequence', v_bag.bag_sequence,
            'total_bags', v_bag.total_bags_snapshot,
            'customer_name', v_order.customer_name_snapshot,
            'customer_mobile_masked', v_masked_phone,
            'delivery_date', v_order.delivery_date,
            'delivery_slot', '10:00 AM - 01:00 PM',
            'delivery_area', v_order.delivery_area_snapshot,
            'delivery_society_street', v_order.delivery_society_street_snapshot,
            'payment_method', upper(v_order.payment_method::text),
            'final_payable_amount', v_order.final_payable_amount,
            'collect_cash_text', 'COLLECT ₹' || to_char(v_order.final_payable_amount, 'FM999990.00'),
            'qr_token', v_bag.qr_token,
            'qr_url', 'https://sabjiwala.in/b/' || v_bag.qr_token,
            'items_summary', v_items_json,
            'is_reprint', p_is_reprint,
            'reprint_reason', p_reprint_reason,
            'printed_at', v_now
        );

        INSERT INTO print_jobs (
            job_type,
            order_id,
            packing_bag_id,
            printer_target,
            label_size,
            payload,
            status,
            requested_by,
            requested_at,
            is_reprint,
            reprint_reason,
            idempotency_key
        ) VALUES (
            'bag_sticker',
            v_order.id,
            v_bag.id,
            COALESCE(v_settings.value->>'printer_target', 'browser'),
            COALESCE(v_settings.value->>'label_size', '100x150'),
            v_payload,
            'queued',
            p_requested_by,
            v_now,
            p_is_reprint,
            p_reprint_reason,
            p_idempotency_key
        ) RETURNING id INTO v_job_id;

        -- Update print stats on packing_bags
        UPDATE packing_bags
        SET 
            print_count = print_count + 1,
            last_printed_at = v_now,
            reprint_count = reprint_count + CASE WHEN p_is_reprint THEN 1 ELSE 0 END
        WHERE id = v_bag.id;
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
        'print_jobs',
        p_order_id::text,
        'INSERT',
        jsonb_build_object(
            'event', CASE WHEN p_is_reprint THEN 'LABEL_REPRINTED' ELSE 'LABEL_PRINTED' END,
            'order_number', v_order.order_number,
            'is_reprint', p_is_reprint,
            'reprint_reason', p_reprint_reason
        ),
        p_requested_by,
        'packing'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'print_job_id', v_job_id,
        'payload', v_payload
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION queue_bag_sticker_print_job(UUID, UUID, BOOLEAN, VARCHAR, UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION queue_bag_sticker_print_job(UUID, UUID, BOOLEAN, VARCHAR, UUID, VARCHAR) TO authenticated, service_role;


-- 9. RPC: Verify Scanned Bag Barcode / QR Code
CREATE OR REPLACE FUNCTION verify_scanned_packing_bag(
    p_order_id UUID,
    p_scanned_barcode_or_token VARCHAR,
    p_staff_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_bag RECORD;
    v_scanned_clean VARCHAR(100);
    v_other_order RECORD;
    v_total_bags INT;
    v_verified_count INT;
    v_all_items_confirmed BOOLEAN;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_scanned_clean := trim(p_scanned_barcode_or_token);

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    -- 1. Check if barcode or QR token exists anywhere in system
    SELECT * INTO v_bag 
    FROM packing_bags 
    WHERE bag_barcode = v_scanned_clean OR qr_token = v_scanned_clean;

    IF v_bag.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error_code', 'UNKNOWN_BAG_BARCODE', 
            'message', 'Scanned barcode or QR token was not found in system.'
        );
    END IF;

    -- 2. Check if bag belongs to a different order (WRONG BAG PROTECTION)
    IF v_bag.order_id <> p_order_id THEN
        SELECT order_number INTO v_other_order FROM orders WHERE id = v_bag.order_id;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'WRONG_BAG_SCANNED',
            'expected_order_number', v_order.order_number,
            'scanned_order_number', v_other_order.order_number,
            'scanned_bag_sequence', v_bag.bag_sequence,
            'message', format('WRONG BAG! Scanned bag belongs to %s, not %s.', v_other_order.order_number, v_order.order_number)
        );
    END IF;

    -- 3. Check duplicate verification
    IF v_bag.is_verified THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'BAG_ALREADY_VERIFIED',
            'bag_sequence', v_bag.bag_sequence,
            'total_bags', v_bag.total_bags_snapshot,
            'message', format('Bag %s/%s is already verified.', v_bag.bag_sequence, v_bag.total_bags_snapshot)
        );
    END IF;

    -- 4. Mark bag verified
    UPDATE packing_bags
    SET 
        is_verified = true,
        verified_at = v_now,
        verified_by_user_id = p_staff_user_id
    WHERE id = v_bag.id;

    -- Check how many bags verified for this order
    SELECT COUNT(*), COUNT(CASE WHEN is_verified THEN 1 END) 
    INTO v_total_bags, v_verified_count
    FROM packing_bags 
    WHERE order_id = p_order_id;

    -- Check if all order items are confirmed
    SELECT NOT EXISTS (
        SELECT 1 FROM order_items WHERE order_id = p_order_id AND is_packed_confirmed = false
    ) INTO v_all_items_confirmed;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'packing_bags',
        v_bag.id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'BAG_VERIFIED',
            'order_number', v_order.order_number,
            'bag_sequence', v_bag.bag_sequence,
            'total_bags', v_total_bags
        ),
        p_staff_user_id,
        'packing'
    );

    RETURN jsonb_build_object(
        'success', true,
        'verified_bag_sequence', v_bag.bag_sequence,
        'total_bags', v_total_bags,
        'verified_count', v_verified_count,
        'all_bags_verified', (v_verified_count = v_total_bags),
        'all_items_confirmed', v_all_items_confirmed,
        'can_mark_ready', (v_verified_count = v_total_bags AND v_all_items_confirmed AND v_order.packing_status <> 'problem')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION verify_scanned_packing_bag(UUID, VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_scanned_packing_bag(UUID, VARCHAR, UUID) TO authenticated, service_role;


-- 10. RPC: Mark Order Ready for Delivery (Atomic Completion Gate)
CREATE OR REPLACE FUNCTION mark_order_ready_for_delivery(
    p_order_id UUID,
    p_staff_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_unconfirmed_items INT;
    v_unverified_bags INT;
    v_total_bags INT;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    IF v_order.order_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_CANCELLED', 'message', 'Cannot pack a cancelled order.');
    END IF;

    IF v_order.packing_status = 'problem' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNRESOLVED_PACKING_PROBLEM', 'message', 'Cannot mark ready while a packing problem is unresolved.');
    END IF;

    -- Verification check 1: All items confirmed
    SELECT COUNT(*) INTO v_unconfirmed_items
    FROM order_items 
    WHERE order_id = p_order_id AND is_packed_confirmed = false;

    IF v_unconfirmed_items > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error_code', 'UNCONFIRMED_ITEMS_REMAINING', 
            'unconfirmed_count', v_unconfirmed_items,
            'message', format('%s item(s) have not been confirmed packed.', v_unconfirmed_items)
        );
    END IF;

    -- Verification check 2: All bags verified
    SELECT COUNT(*), COUNT(CASE WHEN NOT is_verified THEN 1 END) 
    INTO v_total_bags, v_unverified_bags
    FROM packing_bags 
    WHERE order_id = p_order_id;

    IF v_total_bags = 0 OR v_unverified_bags > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error_code', 'UNVERIFIED_BAGS_REMAINING', 
            'unverified_count', v_unverified_bags,
            'total_bags', v_total_bags,
            'message', format('%s of %s bags have not been scanned & verified.', v_unverified_bags, v_total_bags)
        );
    END IF;

    -- Transition to Packed / Verified Ready
    UPDATE orders
    SET 
        order_status = 'packed'::order_status_type,
        packing_status = 'verified',
        packed_at = COALESCE(packed_at, v_now),
        packing_verified_at = v_now,
        updated_at = v_now
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        p_order_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'ORDER_PACKED_AND_READY',
            'order_number', v_order.order_number,
            'total_bags', v_total_bags
        ),
        p_staff_user_id,
        'packing'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order.order_number,
        'order_status', 'packed',
        'packing_status', 'verified',
        'total_bags', v_total_bags
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION mark_order_ready_for_delivery(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_order_ready_for_delivery(UUID, UUID) TO authenticated, service_role;


-- 11. RPC: Packing Queue Inspector with Snapshots
CREATE OR REPLACE FUNCTION get_packing_queue(
    p_delivery_date DATE DEFAULT NULL,
    p_status_filter VARCHAR DEFAULT 'all',
    p_search_term VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_target_date DATE;
    v_orders JSONB := '[]'::jsonb;
    v_rec RECORD;
    v_search TEXT;
BEGIN
    IF p_delivery_date IS NOT NULL THEN
        v_target_date := p_delivery_date;
    ELSE
        v_target_date := (now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day';
    END IF;

    v_search := NULLIF(trim(p_search_term), '');

    FOR v_rec IN
        SELECT 
            o.id AS order_id,
            o.order_number,
            o.delivery_date,
            o.delivery_slot_start,
            o.delivery_slot_end,
            o.order_status,
            o.packing_status,
            o.payment_method,
            o.final_payable_amount,
            o.customer_name_snapshot,
            o.customer_mobile_snapshot,
            o.delivery_area_snapshot,
            o.delivery_society_street_snapshot,
            o.delivery_flat_house_snapshot,
            o.special_instructions,
            o.total_bags_count,
            o.packing_started_at,
            o.packed_by_name,
            o.packed_by_user_id,
            o.packing_problem_type,
            o.packing_problem_notes,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS total_items_count,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.is_packed_confirmed = true) AS confirmed_items_count,
            (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', pb.id,
                    'bag_barcode', pb.bag_barcode,
                    'bag_sequence', pb.bag_sequence,
                    'total_bags', pb.total_bags_snapshot,
                    'is_verified', pb.is_verified,
                    'print_count', pb.print_count,
                    'qr_token', pb.qr_token
                ) ORDER BY pb.bag_sequence ASC), '[]'::jsonb)
                FROM packing_bags pb
                WHERE pb.order_id = o.id
            ) AS bags,
            (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', oi.id,
                    'product_id', oi.product_id,
                    'name_en', oi.product_name_en_snapshot,
                    'name_gu', oi.product_name_gu_snapshot,
                    'variant_en', oi.variant_name_en_snapshot,
                    'variant_gu', oi.variant_name_gu_snapshot,
                    'quantity', oi.quantity,
                    'packed_quantity', oi.packed_quantity,
                    'unit_code', oi.unit_code_snapshot,
                    'is_confirmed', oi.is_packed_confirmed,
                    'packing_notes', oi.packing_notes
                ) ORDER BY oi.created_at ASC), '[]'::jsonb)
                FROM order_items oi
                WHERE oi.order_id = o.id
            ) AS items
        FROM orders o
        WHERE o.delivery_date = v_target_date
          AND o.order_status NOT IN ('payment_pending', 'cancelled')
          AND (
              p_status_filter = 'all' 
              OR (p_status_filter = 'waiting' AND o.packing_status = 'waiting')
              OR (p_status_filter = 'packing' AND o.packing_status = 'packing')
              OR (p_status_filter = 'packed' AND o.packing_status = 'packed')
              OR (p_status_filter = 'verified' AND o.packing_status = 'verified')
              OR (p_status_filter = 'problem' AND o.packing_status = 'problem')
          )
          AND (
              v_search IS NULL
              OR o.order_number ILIKE '%' || v_search || '%'
              OR o.customer_name_snapshot ILIKE '%' || v_search || '%'
              OR o.customer_mobile_snapshot ILIKE '%' || v_search || '%'
              OR o.delivery_area_snapshot ILIKE '%' || v_search || '%'
              OR EXISTS (
                  SELECT 1 FROM packing_bags pb 
                  WHERE pb.order_id = o.id AND pb.bag_barcode ILIKE '%' || v_search || '%'
              )
          )
        ORDER BY 
            CASE o.packing_status
                WHEN 'problem' THEN 1
                WHEN 'packing' THEN 2
                WHEN 'waiting' THEN 3
                WHEN 'packed' THEN 4
                WHEN 'verified' THEN 5
                ELSE 6
            END ASC,
            o.placed_at ASC
    LOOP
        v_orders := v_orders || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'target_date', v_target_date,
        'orders', v_orders
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_packing_queue(DATE, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_packing_queue(DATE, VARCHAR, VARCHAR) TO authenticated, service_role;


-- 12. RPC: Packing Dashboard Summary Aggregates
CREATE OR REPLACE FUNCTION get_packing_dashboard_stats(
    p_delivery_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_target_date DATE;
    v_total_orders INT := 0;
    v_waiting INT := 0;
    v_packing INT := 0;
    v_packed INT := 0;
    v_verified INT := 0;
    v_problem INT := 0;
    v_total_bags INT := 0;
    v_verified_bags INT := 0;
    v_printed_bags INT := 0;
    v_failed_prints INT := 0;
BEGIN
    IF p_delivery_date IS NOT NULL THEN
        v_target_date := p_delivery_date;
    ELSE
        v_target_date := (now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day';
    END IF;

    SELECT 
        COUNT(*),
        COUNT(CASE WHEN packing_status = 'waiting' THEN 1 END),
        COUNT(CASE WHEN packing_status = 'packing' THEN 1 END),
        COUNT(CASE WHEN packing_status = 'packed' THEN 1 END),
        COUNT(CASE WHEN packing_status = 'verified' THEN 1 END),
        COUNT(CASE WHEN packing_status = 'problem' THEN 1 END)
    INTO 
        v_total_orders,
        v_waiting,
        v_packing,
        v_packed,
        v_verified,
        v_problem
    FROM orders
    WHERE delivery_date = v_target_date AND order_status NOT IN ('payment_pending', 'cancelled');

    SELECT 
        COUNT(*),
        COUNT(CASE WHEN is_verified THEN 1 END),
        COUNT(CASE WHEN print_count > 0 THEN 1 END)
    INTO 
        v_total_bags,
        v_verified_bags,
        v_printed_bags
    FROM packing_bags pb
    JOIN orders o ON pb.order_id = o.id
    WHERE o.delivery_date = v_target_date AND o.order_status NOT IN ('payment_pending', 'cancelled');

    SELECT COUNT(*) INTO v_failed_prints
    FROM print_jobs pj
    JOIN orders o ON pj.order_id = o.id
    WHERE o.delivery_date = v_target_date AND pj.status = 'failed';

    RETURN jsonb_build_object(
        'success', true,
        'delivery_date', v_target_date,
        'orders', jsonb_build_object(
            'total', v_total_orders,
            'waiting', v_waiting,
            'packing', v_packing,
            'packed', v_packed,
            'verified', v_verified,
            'problem', v_problem
        ),
        'bags', jsonb_build_object(
            'expected', v_total_bags,
            'verified', v_verified_bags,
            'printed', v_printed_bags,
            'failed_prints', v_failed_prints
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_packing_dashboard_stats(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_packing_dashboard_stats(DATE) TO authenticated, service_role;

COMMIT;
