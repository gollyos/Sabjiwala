-- =============================================================================
-- SABJIWALA: DELIVERY MANAGEMENT + DRIVER MOBILE + COD SETTLEMENT MODULE
-- =============================================================================

BEGIN;

-- 1. Table Alterations: Extend deliveries & packing_bags
ALTER TABLE deliveries
    ADD COLUMN IF NOT EXISTS payment_collection_method VARCHAR(30),
    ADD COLUMN IF NOT EXISTS cash_collected_amount NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS upi_collected_amount NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS amount_mismatch_reason TEXT,
    ADD COLUMN IF NOT EXISTS delivery_problem_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS delivery_problem_notes TEXT,
    ADD COLUMN IF NOT EXISTS rescheduled_from_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS rescheduled_to_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS rescheduled_by UUID REFERENCES user_profiles(id),
    ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rescheduled_reason TEXT;

ALTER TABLE packing_bags
    ADD COLUMN IF NOT EXISTS is_driver_delivered BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS driver_scanned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS driver_scanned_by UUID REFERENCES user_profiles(id);

-- 2. Create driver_cash_settlements Table
CREATE TABLE IF NOT EXISTS driver_cash_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_batch_id UUID REFERENCES delivery_batches(id) ON DELETE SET NULL,
    driver_user_id UUID NOT NULL REFERENCES user_profiles(id),
    delivery_date DATE NOT NULL,
    expected_cash_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    collected_cash_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    collected_upi_delivery_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    handed_over_cash_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    difference_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    handed_over_at TIMESTAMPTZ,
    verified_by UUID REFERENCES user_profiles(id),
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_settlements_driver ON driver_cash_settlements(driver_user_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_batch ON driver_cash_settlements(delivery_batch_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_status ON driver_cash_settlements(status);

ALTER TABLE driver_cash_settlements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'driver_cash_settlements' AND policyname = 'Delivery drivers view own settlements'
    ) THEN
        CREATE POLICY "Delivery drivers view own settlements" ON driver_cash_settlements
            FOR SELECT USING (
                driver_user_id = auth.uid() 
                OR has_role('manager'::staff_role_type) 
                OR has_role('owner'::staff_role_type)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'driver_cash_settlements' AND policyname = 'Managers and owners manage settlements'
    ) THEN
        CREATE POLICY "Managers and owners manage settlements" ON driver_cash_settlements
            FOR ALL USING (
                has_role('manager'::staff_role_type) 
                OR has_role('owner'::staff_role_type)
            );
    END IF;
END $$;


-- 3. RPC: Create Delivery Batch with Order Assignment
CREATE OR REPLACE FUNCTION create_delivery_batch(
    p_delivery_date DATE,
    p_delivery_slot VARCHAR,
    p_driver_user_id UUID,
    p_order_ids UUID[],
    p_created_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_batch_id UUID;
    v_batch_name VARCHAR(100);
    v_batch_seq INT;
    v_order_id UUID;
    v_order RECORD;
    v_seq INT := 1;
    v_total_assigned INT := 0;
    v_now TIMESTAMPTZ := now();
BEGIN
    IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NO_ORDERS_SELECTED', 'message', 'Please select at least one order to create a delivery batch.');
    END IF;

    -- Validate Driver Profile & Role
    IF p_driver_user_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN user_roles ur ON ur.user_id = up.id
            WHERE up.id = p_driver_user_id AND up.is_active = true AND ur.role = 'delivery'
        ) THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DRIVER', 'message', 'Selected driver user is not an active delivery partner.');
        END IF;
    END IF;

    -- Generate Batch Name: e.g. DB-20260817-HALOL-01
    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_batch_seq 
    FROM delivery_batches 
    WHERE delivery_date = p_delivery_date;

    v_batch_name := 'DB-' || to_char(p_delivery_date, 'YYYYMMDD') || '-HALOL-' || lpad(v_batch_seq::text, 2, '0');

    -- Create Delivery Batch Record
    INSERT INTO delivery_batches (
        batch_name,
        delivery_date,
        delivery_slot,
        driver_user_id,
        status,
        total_deliveries,
        completed_deliveries
    ) VALUES (
        v_batch_name,
        p_delivery_date,
        COALESCE(p_delivery_slot, '10:00 AM - 01:00 PM'),
        p_driver_user_id,
        CASE WHEN p_driver_user_id IS NOT NULL THEN 'assigned'::delivery_batch_status_type ELSE 'draft'::delivery_batch_status_type END,
        array_length(p_order_ids, 1),
        0
    ) RETURNING id INTO v_batch_id;

    -- Assign Each Order
    FOREACH v_order_id IN ARRAY p_order_ids LOOP
        SELECT * INTO v_order 
        FROM orders 
        WHERE id = v_order_id 
        FOR UPDATE;

        IF v_order.id IS NULL THEN
            RAISE EXCEPTION 'Order % not found', v_order_id;
        END IF;

        IF v_order.order_status = 'cancelled' THEN
            RAISE EXCEPTION 'Cannot assign cancelled order %', v_order.order_number;
        END IF;

        IF v_order.packing_status = 'problem' THEN
            RAISE EXCEPTION 'Cannot assign order % with unresolved packing problem', v_order.order_number;
        END IF;

        -- Check if order already has an active delivery
        IF EXISTS (SELECT 1 FROM deliveries WHERE order_id = v_order_id AND status IN ('pending', 'out_for_delivery', 'delivered')) THEN
            RAISE EXCEPTION 'Order % is already assigned to an active delivery.', v_order.order_number;
        END IF;

        -- Insert Delivery Record
        INSERT INTO deliveries (
            delivery_batch_id,
            order_id,
            driver_user_id,
            delivery_sequence,
            status,
            cod_amount_expected,
            cod_amount_collected
        ) VALUES (
            v_batch_id,
            v_order_id,
            p_driver_user_id,
            v_seq,
            'pending'::delivery_status_type,
            v_order.final_payable_amount,
            0.00
        )
        ON CONFLICT (order_id) DO UPDATE
        SET 
            delivery_batch_id = EXCLUDED.delivery_batch_id,
            driver_user_id = EXCLUDED.driver_user_id,
            delivery_sequence = EXCLUDED.delivery_sequence,
            status = 'pending'::delivery_status_type,
            cod_amount_expected = EXCLUDED.cod_amount_expected,
            updated_at = v_now;

        v_seq := v_seq + 1;
        v_total_assigned := v_total_assigned + 1;
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
        'delivery_batches',
        v_batch_id::text,
        'INSERT',
        jsonb_build_object(
            'event', 'DELIVERY_BATCH_CREATED',
            'batch_name', v_batch_name,
            'delivery_date', p_delivery_date,
            'driver_user_id', p_driver_user_id,
            'total_orders', v_total_assigned
        ),
        p_created_by,
        'manager'
    );

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'batch_name', v_batch_name,
        'delivery_date', p_delivery_date,
        'total_assigned', v_total_assigned
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_delivery_batch(DATE, VARCHAR, UUID, UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_delivery_batch(DATE, VARCHAR, UUID, UUID[], UUID) TO authenticated, service_role;


-- 4. RPC: Start Delivery Batch (Driver Dispatch)
CREATE OR REPLACE FUNCTION start_delivery_batch(
    p_batch_id UUID,
    p_driver_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_now TIMESTAMPTZ := now();
    v_orders_updated INT := 0;
BEGIN
    SELECT * INTO v_batch 
    FROM delivery_batches 
    WHERE id = p_batch_id 
    FOR UPDATE;

    IF v_batch.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'BATCH_NOT_FOUND', 'message', 'Delivery batch not found.');
    END IF;

    -- Update Batch
    UPDATE delivery_batches
    SET 
        status = 'out_for_delivery'::delivery_batch_status_type,
        started_at = COALESCE(started_at, v_now),
        driver_user_id = COALESCE(p_driver_user_id, driver_user_id),
        updated_at = v_now
    WHERE id = p_batch_id;

    -- Update Deliveries
    UPDATE deliveries
    SET 
        status = 'out_for_delivery'::delivery_status_type,
        driver_user_id = COALESCE(p_driver_user_id, driver_user_id),
        updated_at = v_now
    WHERE delivery_batch_id = p_batch_id AND status = 'pending'::delivery_status_type;

    -- Update Orders
    WITH updated AS (
        UPDATE orders o
        SET 
            order_status = 'out_for_delivery'::order_status_type,
            updated_at = v_now
        FROM deliveries d
        WHERE d.order_id = o.id 
          AND d.delivery_batch_id = p_batch_id
          AND o.order_status IN ('packed', 'confirmed', 'in_procurement')
        RETURNING o.id
    )
    SELECT COUNT(*) INTO v_orders_updated FROM updated;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'delivery_batches',
        p_batch_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'DELIVERY_BATCH_STARTED',
            'batch_name', v_batch.batch_name,
            'driver_user_id', COALESCE(p_driver_user_id, v_batch.driver_user_id),
            'orders_dispatched', v_orders_updated
        ),
        p_driver_user_id,
        'delivery'
    );

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', p_batch_id,
        'batch_name', v_batch.batch_name,
        'status', 'out_for_delivery',
        'orders_dispatched', v_orders_updated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION start_delivery_batch(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_delivery_batch(UUID, UUID) TO authenticated, service_role;


-- 5. RPC: Driver Bag Scan Verification at Doorstep
CREATE OR REPLACE FUNCTION verify_driver_bag_scan(
    p_order_id UUID,
    p_scanned_code VARCHAR,
    p_driver_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_bag RECORD;
    v_other_order RECORD;
    v_scanned_clean VARCHAR(100);
    v_total_bags INT;
    v_verified_count INT;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_scanned_clean := trim(p_scanned_code);

    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    -- 1. Check if barcode or QR token exists
    SELECT * INTO v_bag 
    FROM packing_bags 
    WHERE bag_barcode = v_scanned_clean OR qr_token = v_scanned_clean;

    IF v_bag.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error_code', 'UNKNOWN_BAG_BARCODE', 
            'message', 'Scanned barcode or QR token was not recognized.'
        );
    END IF;

    -- 2. WRONG BAG PROTECTION: Does this bag belong to another customer order?
    IF v_bag.order_id <> p_order_id THEN
        SELECT order_number INTO v_other_order FROM orders WHERE id = v_bag.order_id;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'WRONG_BAG_SCANNED',
            'expected_order_number', v_order.order_number,
            'scanned_order_number', v_other_order.order_number,
            'scanned_bag_sequence', v_bag.bag_sequence,
            'message', format('WRONG BAG! This bag belongs to order %s, NOT %s.', v_other_order.order_number, v_order.order_number)
        );
    END IF;

    -- 3. Duplicate scan check
    IF v_bag.is_driver_delivered THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'BAG_ALREADY_SCANNED',
            'bag_sequence', v_bag.bag_sequence,
            'total_bags', v_bag.total_bags_snapshot,
            'message', format('Bag %s/%s was already scanned.', v_bag.bag_sequence, v_bag.total_bags_snapshot)
        );
    END IF;

    -- 4. Mark bag verified for delivery
    UPDATE packing_bags
    SET 
        is_driver_delivered = true,
        driver_scanned_at = v_now,
        driver_scanned_by = p_driver_user_id
    WHERE id = v_bag.id;

    -- Count total & scanned bags
    SELECT COUNT(*), COUNT(CASE WHEN is_driver_delivered THEN 1 END)
    INTO v_total_bags, v_verified_count
    FROM packing_bags
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'verified_bag_sequence', v_bag.bag_sequence,
        'total_bags', v_total_bags,
        'verified_count', v_verified_count,
        'all_bags_verified', (v_verified_count = v_total_bags),
        'message', format('Bag %s of %s scanned successfully.', v_bag.bag_sequence, v_total_bags)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION verify_driver_bag_scan(UUID, VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_driver_bag_scan(UUID, VARCHAR, UUID) TO authenticated, service_role;


-- 6. RPC: Atomic Delivery Completion & COD Collection Transaction
CREATE OR REPLACE FUNCTION complete_order_delivery(
    p_order_id UUID,
    p_collection_method VARCHAR, -- 'cash' or 'upi_delivery'
    p_collected_amount NUMERIC,
    p_mismatch_reason TEXT DEFAULT NULL,
    p_driver_user_id UUID DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_delivery RECORD;
    v_batch RECORD;
    v_unverified_bags INT;
    v_total_bags INT;
    v_expected_amount NUMERIC;
    v_cash_col NUMERIC := 0.00;
    v_upi_col NUMERIC := 0.00;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    -- Idempotency check: If order is ALREADY delivered, return existing state safely
    IF v_order.order_status = 'delivered' THEN
        SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id;
        RETURN jsonb_build_object(
            'success', true,
            'is_idempotent_replay', true,
            'order_id', p_order_id,
            'order_number', v_order.order_number,
            'order_status', 'delivered',
            'delivered_at', v_delivery.delivered_at,
            'cod_amount_collected', v_delivery.cod_amount_collected,
            'message', 'Order is already marked delivered.'
        );
    END IF;

    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id FOR UPDATE;
    IF v_delivery.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'DELIVERY_NOT_FOUND', 'message', 'Delivery assignment not found for order.');
    END IF;

    -- 1. Bag verification check: All bags MUST be scanned & verified
    SELECT COUNT(*), COUNT(CASE WHEN NOT is_driver_delivered THEN 1 END)
    INTO v_total_bags, v_unverified_bags
    FROM packing_bags
    WHERE order_id = p_order_id;

    IF v_total_bags = 0 OR v_unverified_bags > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNVERIFIED_BAGS_REMAINING',
            'unverified_count', v_unverified_bags,
            'total_bags', v_total_bags,
            'message', format('Cannot deliver: %s of %s bags have not been scanned.', v_unverified_bags, v_total_bags)
        );
    END IF;

    -- 2. COD Amount validation
    v_expected_amount := v_order.final_payable_amount;
    IF p_collected_amount IS NULL OR p_collected_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COLLECTED_AMOUNT', 'message', 'Collected COD amount is invalid.');
    END IF;

    IF p_collection_method NOT IN ('cash', 'upi_delivery') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_COLLECTION_METHOD', 'message', 'Collection method must be cash or upi_delivery.');
    END IF;

    -- If amount differs from expected, require mismatch reason
    IF p_collected_amount <> v_expected_amount AND (p_mismatch_reason IS NULL OR trim(p_mismatch_reason) = '') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'AMOUNT_MISMATCH_REASON_REQUIRED',
            'expected_amount', v_expected_amount,
            'collected_amount', p_collected_amount,
            'difference', (p_collected_amount - v_expected_amount),
            'message', format('Amount mismatch (Expected ₹%s, Collected ₹%s). Please provide a reason.', v_expected_amount, p_collected_amount)
        );
    END IF;

    IF p_collection_method = 'cash' THEN
        v_cash_col := p_collected_amount;
        v_upi_col := 0.00;
    ELSE
        v_cash_col := 0.00;
        v_upi_col := p_collected_amount;
    END IF;

    -- 3. Update Delivery Record
    UPDATE deliveries
    SET 
        status = 'delivered'::delivery_status_type,
        cod_amount_collected = p_collected_amount,
        payment_collection_method = p_collection_method,
        cash_collected_amount = v_cash_col,
        upi_collected_amount = v_upi_col,
        amount_mismatch_reason = p_mismatch_reason,
        delivered_at = v_now,
        updated_at = v_now
    WHERE id = v_delivery.id;

    -- 4. Update Order Record
    UPDATE orders
    SET 
        order_status = 'delivered'::order_status_type,
        payment_status = 'completed'::payment_status_type,
        updated_at = v_now
    WHERE id = p_order_id;

    -- 5. Create or Update Payment Ledger Record
    INSERT INTO payments (
        order_id,
        payment_method,
        amount,
        status,
        collected_by_delivery_user_id,
        collected_at,
        gateway_response
    ) VALUES (
        p_order_id,
        'cod'::payment_method_type,
        p_collected_amount,
        'completed'::payment_status_type,
        p_driver_user_id,
        v_now,
        jsonb_build_object(
            'collection_method', p_collection_method,
            'expected_amount', v_expected_amount,
            'collected_amount', p_collected_amount,
            'mismatch_reason', p_mismatch_reason,
            'idempotency_key', p_idempotency_key
        )
    );

    -- 6. Consume FIRST500 Promotion (reserved -> consumed)
    UPDATE promotion_usage
    SET 
        status = 'consumed'::promo_usage_status_type,
        used_at = v_now
    WHERE order_id = p_order_id AND status = 'reserved'::promo_usage_status_type;

    -- 7. Update Delivery Batch Completed Count
    IF v_delivery.delivery_batch_id IS NOT NULL THEN
        UPDATE delivery_batches
        SET 
            completed_deliveries = (
                SELECT COUNT(*) FROM deliveries 
                WHERE delivery_batch_id = v_delivery.delivery_batch_id AND status = 'delivered'::delivery_status_type
            ),
            updated_at = v_now
        WHERE id = v_delivery.delivery_batch_id;
    END IF;

    -- 8. Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'deliveries',
        v_delivery.id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'ORDER_DELIVERED_COD_COLLECTED',
            'order_number', v_order.order_number,
            'collection_method', p_collection_method,
            'expected_amount', v_expected_amount,
            'collected_amount', p_collected_amount,
            'mismatch_reason', p_mismatch_reason,
            'driver_user_id', p_driver_user_id
        ),
        p_driver_user_id,
        'delivery'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order.order_number,
        'order_status', 'delivered',
        'payment_status', 'completed',
        'cod_amount_collected', p_collected_amount,
        'payment_collection_method', p_collection_method,
        'delivered_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION complete_order_delivery(UUID, VARCHAR, NUMERIC, TEXT, UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_order_delivery(UUID, VARCHAR, NUMERIC, TEXT, UUID, VARCHAR) TO authenticated, service_role;


-- 7. RPC: Record Delivery Failure
CREATE OR REPLACE FUNCTION record_delivery_failure(
    p_order_id UUID,
    p_failure_reason VARCHAR,
    p_notes TEXT DEFAULT NULL,
    p_driver_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_delivery RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id FOR UPDATE;
    IF v_delivery.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'DELIVERY_NOT_FOUND', 'message', 'Delivery assignment not found for order.');
    END IF;

    -- Update Delivery
    UPDATE deliveries
    SET 
        status = 'failed'::delivery_status_type,
        failure_reason = p_failure_reason,
        delivery_problem_notes = p_notes,
        updated_at = v_now
    WHERE id = v_delivery.id;

    -- Update Order
    UPDATE orders
    SET 
        order_status = 'failed_delivery'::order_status_type,
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
        'deliveries',
        v_delivery.id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'DELIVERY_FAILED',
            'order_number', v_order.order_number,
            'failure_reason', p_failure_reason,
            'notes', p_notes,
            'driver_user_id', p_driver_user_id
        ),
        p_driver_user_id,
        'delivery'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_status', 'failed_delivery',
        'failure_reason', p_failure_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION record_delivery_failure(UUID, VARCHAR, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_delivery_failure(UUID, VARCHAR, TEXT, UUID) TO authenticated, service_role;


-- 8. RPC: Reschedule Failed Delivery (Manager/Owner Action)
CREATE OR REPLACE FUNCTION reschedule_failed_delivery(
    p_order_id UUID,
    p_new_delivery_date DATE,
    p_reason TEXT DEFAULT NULL,
    p_manager_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_delivery RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id FOR UPDATE;
    IF v_delivery.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'DELIVERY_NOT_FOUND', 'message', 'Delivery assignment not found for order.');
    END IF;

    -- Update Delivery Record with Reschedule Audit
    UPDATE deliveries
    SET 
        status = 'rescheduled'::delivery_status_type,
        rescheduled_from_delivery_date = v_order.delivery_date,
        rescheduled_to_delivery_date = p_new_delivery_date,
        rescheduled_by = p_manager_user_id,
        rescheduled_at = v_now,
        rescheduled_reason = p_reason,
        updated_at = v_now
    WHERE id = v_delivery.id;

    -- Reset Order to 'packed' with new delivery date
    UPDATE orders
    SET 
        delivery_date = p_new_delivery_date,
        order_status = 'packed'::order_status_type,
        packing_status = 'verified',
        updated_at = v_now
    WHERE id = p_order_id;

    -- Reset bag delivery scan state
    UPDATE packing_bags
    SET 
        is_driver_delivered = false,
        driver_scanned_at = NULL,
        driver_scanned_by = NULL
    WHERE order_id = p_order_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'deliveries',
        v_delivery.id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'DELIVERY_RESCHEDULED',
            'order_number', v_order.order_number,
            'old_date', v_order.delivery_date,
            'new_date', p_new_delivery_date,
            'reason', p_reason
        ),
        p_manager_user_id,
        'manager'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'new_delivery_date', p_new_delivery_date,
        'order_status', 'packed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION reschedule_failed_delivery(UUID, DATE, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reschedule_failed_delivery(UUID, DATE, TEXT, UUID) TO authenticated, service_role;


-- 9. RPC: Submit Driver Cash Settlement (Godown Cash Handover)
CREATE OR REPLACE FUNCTION submit_driver_cash_settlement(
    p_delivery_batch_id UUID,
    p_driver_user_id UUID,
    p_handed_over_cash NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_expected_cash NUMERIC := 0.00;
    v_collected_cash NUMERIC := 0.00;
    v_collected_upi NUMERIC := 0.00;
    v_diff NUMERIC := 0.00;
    v_settlement_id UUID;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_batch FROM delivery_batches WHERE id = p_delivery_batch_id;
    IF v_batch.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'BATCH_NOT_FOUND', 'message', 'Delivery batch not found.');
    END IF;

    -- Calculate Totals from Delivered Orders in this batch
    SELECT 
        COALESCE(SUM(cod_amount_expected), 0.00),
        COALESCE(SUM(cash_collected_amount), 0.00),
        COALESCE(SUM(upi_collected_amount), 0.00)
    INTO 
        v_expected_cash,
        v_collected_cash,
        v_collected_upi
    FROM deliveries
    WHERE delivery_batch_id = p_delivery_batch_id AND status = 'delivered'::delivery_status_type;

    v_diff := p_handed_over_cash - v_collected_cash;

    INSERT INTO driver_cash_settlements (
        delivery_batch_id,
        driver_user_id,
        delivery_date,
        expected_cash_amount,
        collected_cash_amount,
        collected_upi_delivery_amount,
        handed_over_cash_amount,
        difference_amount,
        status,
        handed_over_at,
        notes
    ) VALUES (
        p_delivery_batch_id,
        p_driver_user_id,
        v_batch.delivery_date,
        v_expected_cash,
        v_collected_cash,
        v_collected_upi,
        p_handed_over_cash,
        v_diff,
        'submitted',
        v_now,
        p_notes
    ) RETURNING id INTO v_settlement_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'driver_cash_settlements',
        v_settlement_id::text,
        'INSERT',
        jsonb_build_object(
            'event', 'CASH_SETTLEMENT_SUBMITTED',
            'batch_name', v_batch.batch_name,
            'driver_user_id', p_driver_user_id,
            'collected_cash', v_collected_cash,
            'handed_over_cash', p_handed_over_cash,
            'difference', v_diff
        ),
        p_driver_user_id,
        'delivery'
    );

    RETURN jsonb_build_object(
        'success', true,
        'settlement_id', v_settlement_id,
        'collected_cash', v_collected_cash,
        'collected_upi', v_collected_upi,
        'handed_over_cash', p_handed_over_cash,
        'difference_amount', v_diff,
        'status', 'submitted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION submit_driver_cash_settlement(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_driver_cash_settlement(UUID, UUID, NUMERIC, TEXT) TO authenticated, service_role;


-- 10. RPC: Verify Owner Cash Settlement
CREATE OR REPLACE FUNCTION verify_owner_cash_settlement(
    p_settlement_id UUID,
    p_status VARCHAR DEFAULT 'verified', -- 'verified' or 'disputed'
    p_notes TEXT DEFAULT NULL,
    p_owner_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_settlement RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_settlement FROM driver_cash_settlements WHERE id = p_settlement_id FOR UPDATE;
    IF v_settlement.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'SETTLEMENT_NOT_FOUND', 'message', 'Settlement record not found.');
    END IF;

    UPDATE driver_cash_settlements
    SET 
        status = p_status,
        verified_by = p_owner_user_id,
        verified_at = v_now,
        notes = COALESCE(p_notes, notes),
        updated_at = v_now
    WHERE id = p_settlement_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'driver_cash_settlements',
        p_settlement_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'CASH_SETTLEMENT_VERIFIED',
            'settlement_id', p_settlement_id,
            'status', p_status,
            'difference_amount', v_settlement.difference_amount,
            'verified_by', p_owner_user_id
        ),
        p_owner_user_id,
        'owner'
    );

    RETURN jsonb_build_object(
        'success', true,
        'settlement_id', p_settlement_id,
        'status', p_status,
        'difference_amount', v_settlement.difference_amount,
        'verified_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION verify_owner_cash_settlement(UUID, VARCHAR, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_owner_cash_settlement(UUID, VARCHAR, TEXT, UUID) TO authenticated, service_role;


-- 11. RPC: Driver Delivery Stops & Progress Summary
CREATE OR REPLACE FUNCTION get_driver_deliveries_summary(
    p_driver_user_id UUID,
    p_delivery_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_target_date DATE;
    v_batch RECORD;
    v_deliveries JSONB := '[]'::jsonb;
    v_rec RECORD;
    v_total INT := 0;
    v_delivered INT := 0;
    v_pending INT := 0;
    v_failed INT := 0;
    v_cash_col NUMERIC := 0.00;
    v_upi_col NUMERIC := 0.00;
BEGIN
    IF p_delivery_date IS NOT NULL THEN
        v_target_date := p_delivery_date;
    ELSE
        v_target_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    END IF;

    -- Find active/assigned batch for driver
    SELECT * INTO v_batch
    FROM delivery_batches
    WHERE driver_user_id = p_driver_user_id AND delivery_date = v_target_date
    ORDER BY created_at DESC
    LIMIT 1;

    FOR v_rec IN
        SELECT 
            d.id AS delivery_id,
            d.delivery_sequence,
            d.status AS delivery_status,
            d.cod_amount_expected,
            d.cod_amount_collected,
            d.payment_collection_method,
            d.failure_reason,
            d.delivered_at,
            o.id AS order_id,
            o.order_number,
            o.delivery_date,
            o.customer_name_snapshot,
            o.customer_mobile_snapshot,
            o.customer_alternate_mobile_snapshot,
            o.delivery_flat_house_snapshot,
            o.delivery_society_street_snapshot,
            o.delivery_landmark_snapshot,
            o.delivery_area_snapshot,
            o.delivery_city_snapshot,
            o.delivery_pincode_snapshot,
            o.delivery_latitude_snapshot,
            o.delivery_longitude_snapshot,
            o.special_instructions,
            o.total_bags_count,
            (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', pb.id,
                    'bag_barcode', pb.bag_barcode,
                    'bag_sequence', pb.bag_sequence,
                    'total_bags', pb.total_bags_snapshot,
                    'qr_token', pb.qr_token,
                    'is_driver_delivered', pb.is_driver_delivered,
                    'driver_scanned_at', pb.driver_scanned_at
                ) ORDER BY pb.bag_sequence ASC), '[]'::jsonb)
                FROM packing_bags pb
                WHERE pb.order_id = o.id
            ) AS bags
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        WHERE d.driver_user_id = p_driver_user_id
          AND o.delivery_date = v_target_date
        ORDER BY d.delivery_sequence ASC
    LOOP
        v_deliveries := v_deliveries || to_jsonb(v_rec);
        v_total := v_total + 1;
        IF v_rec.delivery_status = 'delivered' THEN
            v_delivered := v_delivered + 1;
            IF v_rec.payment_collection_method = 'cash' THEN
                v_cash_col := v_cash_col + v_rec.cod_amount_collected;
            ELSE
                v_upi_col := v_upi_col + v_rec.cod_amount_collected;
            END IF;
        ELSIF v_rec.delivery_status = 'failed' THEN
            v_failed := v_failed + 1;
        ELSE
            v_pending := v_pending + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_date', v_target_date,
        'batch', to_jsonb(v_batch),
        'metrics', jsonb_build_object(
            'total', v_total,
            'delivered', v_delivered,
            'pending', v_pending,
            'failed', v_failed,
            'cash_collected', v_cash_col,
            'upi_collected', v_upi_col,
            'total_collected', (v_cash_col + v_upi_col)
        ),
        'deliveries', v_deliveries
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_driver_deliveries_summary(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_driver_deliveries_summary(UUID, DATE) TO authenticated, service_role;


-- 12. RPC: Admin Delivery Dashboard Summary Stats
CREATE OR REPLACE FUNCTION get_admin_delivery_dashboard_stats(
    p_delivery_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_target_date DATE;
    v_total_assigned INT := 0;
    v_out_for_delivery INT := 0;
    v_delivered INT := 0;
    v_failed INT := 0;
    v_pending INT := 0;
    v_expected_cod NUMERIC := 0.00;
    v_collected_cash NUMERIC := 0.00;
    v_collected_upi NUMERIC := 0.00;
    v_pending_collection NUMERIC := 0.00;
    v_batches JSONB := '[]'::jsonb;
    v_settlements JSONB := '[]'::jsonb;
    v_eligible_orders JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    IF p_delivery_date IS NOT NULL THEN
        v_target_date := p_delivery_date;
    ELSE
        v_target_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    END IF;

    -- Aggregate Delivery Metrics
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN d.status = 'out_for_delivery' THEN 1 END),
        COUNT(CASE WHEN d.status = 'delivered' THEN 1 END),
        COUNT(CASE WHEN d.status = 'failed' THEN 1 END),
        COUNT(CASE WHEN d.status = 'pending' THEN 1 END),
        COALESCE(SUM(d.cod_amount_expected), 0.00),
        COALESCE(SUM(d.cash_collected_amount), 0.00),
        COALESCE(SUM(d.upi_collected_amount), 0.00)
    INTO 
        v_total_assigned,
        v_out_for_delivery,
        v_delivered,
        v_failed,
        v_pending,
        v_expected_cod,
        v_collected_cash,
        v_collected_upi
    FROM deliveries d
    JOIN orders o ON d.order_id = o.id
    WHERE o.delivery_date = v_target_date;

    v_pending_collection := v_expected_cod - (v_collected_cash + v_collected_upi);

    -- Load Batches
    FOR v_rec IN
        SELECT 
            db.id,
            db.batch_name,
            db.delivery_date,
            db.delivery_slot,
            db.status,
            db.total_deliveries,
            db.completed_deliveries,
            db.started_at,
            db.completed_at,
            up.full_name AS driver_name,
            up.mobile AS driver_mobile
        FROM delivery_batches db
        LEFT JOIN user_profiles up ON db.driver_user_id = up.id
        WHERE db.delivery_date = v_target_date
        ORDER BY db.created_at DESC
    LOOP
        v_batches := v_batches || to_jsonb(v_rec);
    END LOOP;

    -- Load Settlements
    FOR v_rec IN
        SELECT 
            dcs.id,
            dcs.delivery_batch_id,
            dcs.delivery_date,
            dcs.expected_cash_amount,
            dcs.collected_cash_amount,
            dcs.collected_upi_delivery_amount,
            dcs.handed_over_cash_amount,
            dcs.difference_amount,
            dcs.status,
            dcs.handed_over_at,
            dcs.verified_at,
            dcs.notes,
            up.full_name AS driver_name,
            v_up.full_name AS verified_by_name
        FROM driver_cash_settlements dcs
        LEFT JOIN user_profiles up ON dcs.driver_user_id = up.id
        LEFT JOIN user_profiles v_up ON dcs.verified_by = v_up.id
        WHERE dcs.delivery_date = v_target_date
        ORDER BY dcs.created_at DESC
    LOOP
        v_settlements := v_settlements || to_jsonb(v_rec);
    END LOOP;

    -- Eligible unassigned packed orders for batch creation
    FOR v_rec IN
        SELECT 
            o.id AS order_id,
            o.order_number,
            o.delivery_area_snapshot,
            o.customer_name_snapshot,
            o.final_payable_amount,
            o.total_bags_count
        FROM orders o
        WHERE o.delivery_date = v_target_date
          AND o.order_status IN ('packed', 'confirmed')
          AND o.packing_status = 'verified'
          AND NOT EXISTS (
              SELECT 1 FROM deliveries d 
              WHERE d.order_id = o.id AND d.status IN ('pending', 'out_for_delivery', 'delivered')
          )
        ORDER BY o.delivery_area_snapshot ASC, o.order_number ASC
    LOOP
        v_eligible_orders := v_eligible_orders || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_date', v_target_date,
        'metrics', jsonb_build_object(
            'total_assigned', v_total_assigned,
            'out_for_delivery', v_out_for_delivery,
            'delivered', v_delivered,
            'failed', v_failed,
            'pending', v_pending,
            'expected_cod', v_expected_cod,
            'collected_cash', v_collected_cash,
            'collected_upi', v_collected_upi,
            'total_collected', (v_collected_cash + v_collected_upi),
            'pending_collection', v_pending_collection
        ),
        'batches', v_batches,
        'settlements', v_settlements,
        'eligible_unassigned_orders', v_eligible_orders
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_admin_delivery_dashboard_stats(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_admin_delivery_dashboard_stats(DATE) TO authenticated, service_role;

COMMIT;
