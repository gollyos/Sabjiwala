-- =============================================================================
-- TEST SUITE: WHATSAPP BUSINESS & NOTIFICATION AUTOMATION MODULE
-- =============================================================================

DO $$
DECLARE
    v_norm1 TEXT;
    v_norm2 TEXT;
    v_norm3 TEXT;
    v_norm4 TEXT;
    
    v_job1 UUID;
    v_job2 UUID;
    v_jobs_count INT;
    
    v_customer_id UUID;
    v_address_id UUID;
    v_order_id UUID;
    v_delivery_id UUID;
    v_batch_id UUID;
    v_settlement_id UUID;
    v_driver_id UUID;
BEGIN
    RAISE NOTICE '>>> STARTING WHATSAPP NOTIFICATIONS TEST SUITE <<<';

    -- 1. Test Phone Number Normalization
    v_norm1 := normalize_e164_indian_mobile('9876543210');
    IF v_norm1 <> '+919876543210' THEN
        RAISE EXCEPTION 'Test 1 Failed: 10-digit normalized to % instead of +919876543210', v_norm1;
    END IF;

    v_norm2 := normalize_e164_indian_mobile('09876543210');
    IF v_norm2 <> '+919876543210' THEN
        RAISE EXCEPTION 'Test 1 Failed: 0-prefixed 11-digit normalized to % instead of +919876543210', v_norm2;
    END IF;

    v_norm3 := normalize_e164_indian_mobile('919876543210');
    IF v_norm3 <> '+919876543210' THEN
        RAISE EXCEPTION 'Test 1 Failed: 91-prefixed 12-digit normalized to % instead of +919876543210', v_norm3;
    END IF;

    v_norm4 := normalize_e164_indian_mobile('+91 98765-43210');
    IF v_norm4 <> '+919876543210' THEN
        RAISE EXCEPTION 'Test 1 Failed: formatted string normalized to % instead of +919876543210', v_norm4;
    END IF;
    RAISE NOTICE 'Test 1 Passed: Mobile normalization works across all Indian formats.';

    -- 2. Test Notification Queue Idempotency
    v_job1 := enqueue_notification_job(
        'TEST_IDEMPOTENCY_KEY_001',
        'ORDER_CONFIRMED',
        '+919876543210',
        'customer_order_confirmed',
        '{"order_number": "SBJ-TEST-001"}'::jsonb
    );
    IF v_job1 IS NULL THEN
        RAISE EXCEPTION 'Test 2 Failed: Initial enqueue returned NULL';
    END IF;

    -- Enqueue same key second time (must be idempotent & return NULL without exception)
    v_job2 := enqueue_notification_job(
        'TEST_IDEMPOTENCY_KEY_001',
        'ORDER_CONFIRMED',
        '+919876543210',
        'customer_order_confirmed',
        '{"order_number": "SBJ-TEST-001"}'::jsonb
    );
    IF v_job2 IS NOT NULL THEN
        RAISE EXCEPTION 'Test 2 Failed: Duplicate key created second job % instead of deduplicating', v_job2;
    END IF;

    SELECT COUNT(*) INTO v_jobs_count 
    FROM notification_jobs 
    WHERE idempotency_key = 'TEST_IDEMPOTENCY_KEY_001';
    
    IF v_jobs_count <> 1 THEN
        RAISE EXCEPTION 'Test 2 Failed: Expected exactly 1 record, found %', v_jobs_count;
    END IF;
    RAISE NOTICE 'Test 2 Passed: Notification queue idempotency and deduplication verified.';

    -- 3. Test Order Confirmation Auto-Trigger
    -- Fetch or create a test customer
    SELECT id INTO v_customer_id FROM customers LIMIT 1;
    IF v_customer_id IS NULL THEN
        INSERT INTO customers (full_name, mobile, is_verified, verified_sequence)
        VALUES ('Test User', '9876500001', true, 1)
        RETURNING id INTO v_customer_id;
    END IF;

    SELECT id INTO v_address_id FROM customer_addresses WHERE customer_id = v_customer_id LIMIT 1;
    IF v_address_id IS NULL THEN
        INSERT INTO customer_addresses (customer_id, address_type, flat_house_number, society_street_name, landmark, area, pincode)
        VALUES (v_customer_id, 'home', 'Flat 101', 'Green Park', 'Near Temple', 'Halol Town', '389350')
        RETURNING id INTO v_address_id;
    END IF;

    INSERT INTO orders (
        order_number,
        customer_id,
        delivery_address_id,
        delivery_date,
        delivery_slot_start,
        delivery_slot_end,
        order_status,
        payment_status,
        payment_method,
        subtotal_amount,
        final_payable_amount,
        customer_snapshot_json,
        delivery_flat_house_snapshot,
        delivery_society_street_snapshot,
        delivery_landmark_snapshot,
        delivery_area_snapshot,
        delivery_city_snapshot,
        delivery_district_snapshot,
        delivery_pincode_snapshot,
        customer_name_snapshot,
        customer_mobile_snapshot
    )
    VALUES (
        'SBJ-NOTIF-TEST-' || substr(gen_random_uuid()::text, 1, 6),
        v_customer_id,
        v_address_id,
        ((now() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day')::date,
        '10:00:00',
        '13:00:00',
        'confirmed',
        'pending',
        'cod',
        350.00,
        343.00,
        '{"full_name": "Test Customer", "mobile": "9876500001"}'::jsonb,
        'Flat 101',
        'Green Park',
        'Near Temple',
        'Halol Town',
        'Halol',
        'Panchmahal',
        '389350',
        'Test Customer',
        '9876500001'
    )
    RETURNING id INTO v_order_id;

    -- Verify tracking_token was auto-generated on order
    IF (SELECT tracking_token FROM orders WHERE id = v_order_id) IS NULL THEN
        RAISE EXCEPTION 'Test 3 Failed: tracking_token not generated on new order';
    END IF;

    -- Verify notification_jobs record was auto-enqueued
    IF NOT EXISTS (
        SELECT 1 FROM notification_jobs 
        WHERE idempotency_key = 'ORDER_CONFIRMED:' || v_order_id::text
    ) THEN
        RAISE EXCEPTION 'Test 3 Failed: ORDER_CONFIRMED job was not auto-enqueued for order %', v_order_id;
    END IF;
    RAISE NOTICE 'Test 3 Passed: ORDER_CONFIRMED notification auto-enqueued on order confirmation.';

    -- 4. Test Out for Delivery & Delivered Notification Triggers
    INSERT INTO deliveries (
        order_id,
        status,
        cod_amount_expected
    )
    VALUES (
        v_order_id,
        'pending',
        343.00
    )
    RETURNING id INTO v_delivery_id;

    -- Transition to out_for_delivery
    UPDATE deliveries 
    SET status = 'out_for_delivery' 
    WHERE id = v_delivery_id;

    IF NOT EXISTS (
        SELECT 1 FROM notification_jobs 
        WHERE idempotency_key = 'OUT_FOR_DELIVERY:' || v_order_id::text
    ) THEN
        RAISE EXCEPTION 'Test 4 Failed: OUT_FOR_DELIVERY job was not auto-enqueued';
    END IF;

    -- Transition to delivered
    UPDATE deliveries 
    SET status = 'delivered', cod_amount_collected = 343.00, cash_collected_amount = 343.00, delivered_at = now()
    WHERE id = v_delivery_id;

    IF NOT EXISTS (
        SELECT 1 FROM notification_jobs 
        WHERE idempotency_key = 'ORDER_DELIVERED:' || v_order_id::text
    ) THEN
        RAISE EXCEPTION 'Test 4 Failed: ORDER_DELIVERED job was not auto-enqueued';
    END IF;
    RAISE NOTICE 'Test 4 Passed: OUT_FOR_DELIVERY and ORDER_DELIVERED triggers verified.';

    -- 5. Test Driver Cash Discrepancy Alert Trigger
    SELECT id INTO v_driver_id FROM user_profiles LIMIT 1;
    IF v_driver_id IS NOT NULL THEN
        INSERT INTO driver_cash_settlements (
            driver_user_id,
            delivery_date,
            expected_cash_amount,
            collected_cash_amount,
            handed_over_cash_amount,
            difference_amount,
            status
        )
        VALUES (
            v_driver_id,
            (now() AT TIME ZONE 'Asia/Kolkata')::date,
            1000.00,
            1000.00,
            900.00,
            -100.00, -- discrepancy of ₹100
            'pending_verification'
        )
        RETURNING id INTO v_settlement_id;

        IF NOT EXISTS (
            SELECT 1 FROM notification_jobs 
            WHERE idempotency_key = 'COD_DISCREPANCY:' || v_settlement_id::text
        ) THEN
            RAISE EXCEPTION 'Test 5 Failed: COD_DISCREPANCY alert was not enqueued for settlement %', v_settlement_id;
        END IF;
        RAISE NOTICE 'Test 5 Passed: COD_DISCREPANCY owner alert auto-enqueued on cash difference.';
    END IF;

    RAISE NOTICE '>>> ALL 5 WHATSAPP NOTIFICATION TESTS PASSED PERFECTLY <<<';
END;
$$;
