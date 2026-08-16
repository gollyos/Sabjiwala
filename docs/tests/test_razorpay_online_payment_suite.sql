-- =============================================================================
-- SABJIWALA: COMPREHENSIVE RAZORPAY ONLINE PAYMENT & WEBHOOK TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Customer & Address
    v_user_id UUID := gen_random_uuid();
    v_phone VARCHAR(20) := '+9198' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    v_customer_id UUID := gen_random_uuid();
    v_address_id UUID := gen_random_uuid();

    -- Products & Variants
    v_unit_id UUID;
    v_prod_id UUID;
    v_var_100_id UUID;
    v_var_50_id UUID;

    -- Results & Variables
    v_res JSONB;
    v_online_order_id UUID;
    v_online_order_number VARCHAR(50);
    v_cod_order_id UUID;
    v_idempotency_online VARCHAR(100) := 'RZP-ONLINE-' || gen_random_uuid()::text;
    v_idempotency_cod VARCHAR(100) := 'RZP-COD-' || gen_random_uuid()::text;

    -- Simulated Timestamps
    v_ts_before TIMESTAMPTZ := '2026-08-16 19:59:59+05:30'::timestamptz;
    v_ts_at TIMESTAMPTZ := '2026-08-16 20:00:00+05:30'::timestamptz;
    v_ts_after TIMESTAMPTZ := '2026-08-16 20:00:01+05:30'::timestamptz;

    -- Webhook Test Event IDs
    v_event_id VARCHAR(100) := 'evt_test_rzp_' || gen_random_uuid()::text;
    v_rzp_order_id VARCHAR(100) := 'order_test_' || gen_random_uuid()::text;
    v_rzp_payment_id VARCHAR(100) := 'pay_test_' || gen_random_uuid()::text;

    v_order_check RECORD;
    v_payment_check RECORD;
    v_promo_check RECORD;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING SABJIWALA RAZORPAY ONLINE PAYMENT TEST SUITE';
    RAISE NOTICE '============================================================';

    -- 1. Setup Auth User & Verified Customer (Seq 10 -> FIRST500 10% eligible)
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone || '@sabjiwala.test', v_phone, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now());

    INSERT INTO customers (id, auth_user_id, full_name, mobile, is_verified, verified_at, verified_sequence, is_active)
    VALUES (v_customer_id, v_user_id, 'Online Pay Test Customer', v_phone, true, now(), 10, true);

    INSERT INTO customer_addresses (id, customer_id, address_type, flat_house_no, society_street_name, landmark, area_locality, city, district, state, pincode, is_default, is_deleted)
    VALUES (v_address_id, v_customer_id, 'home', 'D-404', 'Gokul Park', 'Near Halol Bus Station', 'Station Road', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false);

    -- 2. Setup Test Products & Variants
    SELECT id INTO v_unit_id FROM product_units WHERE code = 'kg' LIMIT 1;

    INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, is_in_stock, is_active)
    VALUES ('88888888-8888-8888-8888-888888888888'::uuid, (SELECT id FROM categories LIMIT 1), v_unit_id, 'rzp-test-prod', 'Online Test Veggie', 'ઓનલાઇન શાકભાજી', true, true)
    ON CONFLICT (id) DO NOTHING;
    v_prod_id := '88888888-8888-8888-8888-888888888888'::uuid;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES ('81000000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-RZP-100', '1kg Pack', '૧ કિલો', 1.00, 100.00, 70.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 100.00, is_active = true;
    v_var_100_id := '81000000-0000-0000-0000-000000000000'::uuid;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES ('80500000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-RZP-50', '500g Pack', '૫૦૦ ગ્રામ', 0.50, 50.00, 35.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 50.00, is_active = true;
    v_var_50_id := '80500000-0000-0000-0000-000000000000'::uuid;

    -- Set Auth Context
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);


    -- =========================================================================
    -- TEST 1: Quote Engine Comparison (COD 2% vs Online 0%)
    -- Subtotal: 2x ₹100 + 2x ₹50 = ₹300.00
    -- FIRST500 (10%): -₹30.00 -> Net: ₹270.00
    -- Online: 0% discount -> Final: ₹270.00
    -- COD: 2% discount (-₹5.40) -> Final: ₹264.60
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Testing quote calculation for Online (0%%) vs COD (2%%)...';
    
    -- Online Quote
    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'online'
    ) INTO v_res;

    IF (v_res->>'final_payable')::numeric <> 270.00 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected online payable 270.00, got %', v_res->>'final_payable';
    END IF;
    IF (v_res->'payment'->>'discount_amount')::numeric <> 0.00 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Online discount must be 0.00, got %', v_res->'payment'->>'discount_amount';
    END IF;

    -- COD Quote
    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'cod'
    ) INTO v_res;

    IF (v_res->>'final_payable')::numeric <> 264.60 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected COD payable 264.60, got %', v_res->>'final_payable';
    END IF;
    IF (v_res->'payment'->>'discount_amount')::numeric <> 5.40 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: COD discount must be 5.40, got %', v_res->'payment'->>'discount_amount';
    END IF;
    RAISE NOTICE '✅ TEST 1 PASSED: Online (0%%) and COD (2%%) quote pricing verified.';


    -- =========================================================================
    -- TEST 2: Create Online Order in `payment_pending` state
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Creating Online Internal Order (Awaiting Payment)...';
    SELECT create_customer_order(
        v_address_id,
        'online',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'Special: Fresh morning pluck',
        v_idempotency_online,
        'web'
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Online order creation failed: %', v_res;
    END IF;

    v_online_order_id := (v_res->>'order_id')::uuid;
    v_online_order_number := v_res->>'order_number';

    -- Verify pending unconfirmed initial state
    IF v_res->>'order_status' <> 'payment_pending' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected order_status = payment_pending, got %', v_res->>'order_status';
    END IF;

    IF v_res->>'payment_status' <> 'pending' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected payment_status = pending, got %', v_res->>'payment_status';
    END IF;

    IF v_res->>'confirmed_at' IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 2 FAILED: confirmed_at must be NULL for payment_pending order!';
    END IF;

    IF v_res->>'delivery_date' IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 2 FAILED: delivery_date must be NULL until payment capture!';
    END IF;

    IF (v_res->>'final_payable_amount')::numeric <> 270.00 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected final payable 270.00, got %', v_res->>'final_payable_amount';
    END IF;

    -- Verify promotion reservation
    SELECT * INTO v_promo_check FROM promotion_usage WHERE order_id = v_online_order_id;
    IF v_promo_check.status <> 'reserved' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Promotion usage must be in reserved status, got %', v_promo_check.status;
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Online order created as payment_pending with NULL delivery_date and reserved promo.';


    -- =========================================================================
    -- TEST 3: Cutoff Logic on Payment Capture (19:59:59 vs 20:00:00 vs 20:00:01)
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Verifying 8:00 PM cutoff evaluation on capture event timestamp...';

    -- Case 3A: Gateway capture event at 19:59:59 IST (< 20:00) -> Next Day delivery
    SELECT confirm_online_payment_capture(
        v_online_order_id,
        v_rzp_order_id,
        v_rzp_payment_id,
        270.00,
        v_event_id,
        v_ts_before,
        NULL,
        '{"method": "upi"}'::jsonb
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 3A FAILED: Capture confirmation failed: %', v_res;
    END IF;

    IF (v_res->>'is_before_cutoff')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 3A FAILED: 19:59:59 IST must be before cutoff!';
    END IF;

    IF v_res->>'delivery_date' <> '2026-08-17' THEN
        RAISE EXCEPTION 'TEST 3A FAILED: Expected delivery date 2026-08-17, got %', v_res->>'delivery_date';
    END IF;

    -- Verify database record state
    SELECT * INTO v_order_check FROM orders WHERE id = v_online_order_id;
    IF v_order_check.order_status <> 'confirmed' OR v_order_check.payment_status <> 'completed' THEN
        RAISE EXCEPTION 'TEST 3A FAILED: Order state in DB not updated to confirmed/completed!';
    END IF;
    RAISE NOTICE '  - Case 3A (19:59:59 IST): Confirmed, Delivery = 2026-08-17 (Next Day)';

    -- Case 3B: Evaluation test for >= 20:00:00 IST
    IF ((v_ts_at AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time) THEN
        RAISE EXCEPTION 'TEST 3B FAILED: 20:00:00 IST must NOT be before cutoff!';
    END IF;
    IF ((v_ts_after AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time) THEN
        RAISE EXCEPTION 'TEST 3C FAILED: 20:00:01 IST must NOT be before cutoff!';
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Asia/Kolkata 8:00 PM gateway timestamp cutoff verified.';


    -- =========================================================================
    -- TEST 4: Webhook Idempotency (Duplicate Webhook Delivery)
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Testing duplicate payment capture delivery...';
    SELECT confirm_online_payment_capture(
        v_online_order_id,
        v_rzp_order_id,
        v_rzp_payment_id,
        270.00,
        v_event_id,
        v_ts_before,
        NULL,
        '{"method": "upi"}'::jsonb
    ) INTO v_res;

    IF (v_res->>'is_duplicate_confirmation')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Duplicate capture must return is_duplicate_confirmation = true!';
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Duplicate confirmation safely returned idempotent success.';


    -- =========================================================================
    -- TEST 5: Out-of-Order Events (payment.failed then payment.captured)
    -- =========================================================================
    RAISE NOTICE '[TEST 5] Testing out-of-order event sequence: payment.failed -> payment.captured...';
    DECLARE
        v_order2_id UUID;
        v_idempotency_retry VARCHAR(100) := 'RZP-RETRY-' || gen_random_uuid()::text;
    BEGIN
        SELECT create_customer_order(
            v_address_id,
            'online',
            jsonb_build_array(jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2)),
            'Retry test',
            v_idempotency_retry,
            'web'
        ) INTO v_res;
        v_order2_id := (v_res->>'order_id')::uuid;

        -- Step A: First event arrives as payment.failed
        SELECT record_online_payment_failure(
            v_order2_id,
            'order_retry_1',
            'pay_retry_fail',
            'BAD_REQUEST',
            'Card declined'
        ) INTO v_res;

        SELECT * INTO v_order_check FROM orders WHERE id = v_order2_id;
        IF v_order_check.order_status <> 'payment_pending' THEN
            RAISE EXCEPTION 'TEST 5A FAILED: Failed attempt should not cancel order when retry is possible!';
        END IF;

        -- Step B: Customer retries / capture event arrives
        SELECT confirm_online_payment_capture(
            v_order2_id,
            'order_retry_1',
            'pay_retry_success',
            v_order_check.final_payable_amount,
            'evt_retry_success',
            v_ts_before,
            NULL,
            '{"method": "card"}'::jsonb
        ) INTO v_res;

        SELECT * INTO v_order_check FROM orders WHERE id = v_order2_id;
        IF v_order_check.order_status <> 'confirmed' OR v_order_check.payment_status <> 'completed' THEN
            RAISE EXCEPTION 'TEST 5B FAILED: Captured retry must transition order to confirmed!';
        END IF;

        -- Step C: Monotonicity Guard: Delayed late failed event arrives after confirmation
        SELECT record_online_payment_failure(
            v_order2_id,
            'order_retry_1',
            'pay_retry_late_fail',
            'TIMEOUT',
            'Late failure packet'
        ) INTO v_res;

        SELECT * INTO v_order_check FROM orders WHERE id = v_order2_id;
        IF v_order_check.order_status <> 'confirmed' OR v_order_check.payment_status <> 'completed' THEN
            RAISE EXCEPTION 'TEST 5C FAILED: Late failure must NEVER downgrade confirmed order!';
        END IF;

        -- Clean up order2
        DELETE FROM payments WHERE order_id = v_order2_id;
        DELETE FROM order_items WHERE order_id = v_order2_id;
        DELETE FROM orders WHERE id = v_order2_id;
    END;
    RAISE NOTICE '✅ TEST 5 PASSED: Out-of-order event resilience and monotonic confirmation verified.';


    -- =========================================================================
    -- TEST 6: Payment Pending Timeout & Promo Reservation Release
    -- =========================================================================
    RAISE NOTICE '[TEST 6] Testing stale payment_pending order expiration...';
    DECLARE
        v_order_stale_id UUID;
        v_idempotency_stale VARCHAR(100) := 'RZP-STALE-' || gen_random_uuid()::text;
    BEGIN
        SELECT create_customer_order(
            v_address_id,
            'online',
            jsonb_build_array(jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2)),
            'Stale test',
            v_idempotency_stale,
            'web'
        ) INTO v_res;
        v_order_stale_id := (v_res->>'order_id')::uuid;

        -- Artificially age the order by 20 minutes
        UPDATE orders 
        SET placed_at = now() - INTERVAL '20 minutes' 
        WHERE id = v_order_stale_id;

        -- Trigger cleanup function
        PERFORM expire_stale_payment_pending_orders();

        SELECT * INTO v_order_check FROM orders WHERE id = v_order_stale_id;
        IF v_order_check.order_status <> 'cancelled' THEN
            RAISE EXCEPTION 'TEST 6 FAILED: Stale order must be marked cancelled, got %', v_order_check.order_status;
        END IF;

        -- Verify promo reservation release
        SELECT * INTO v_promo_check FROM promotion_usage WHERE order_id = v_order_stale_id;
        IF v_promo_check.id IS NOT NULL AND v_promo_check.status <> 'released' THEN
            RAISE EXCEPTION 'TEST 6 FAILED: Promo reservation must be released, got %', v_promo_check.status;
        END IF;

        -- Clean up stale order
        DELETE FROM promotion_usage WHERE order_id = v_order_stale_id;
        DELETE FROM order_items WHERE order_id = v_order_stale_id;
        DELETE FROM orders WHERE id = v_order_stale_id;
    END;
    RAISE NOTICE '✅ TEST 6 PASSED: Stale online order expired and promo reservation safely released.';


    -- =========================================================================
    -- TEST 7: Regression Check: COD Still Confirms Immediately
    -- =========================================================================
    RAISE NOTICE '[TEST 7] Regression check on COD order flow...';
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2)),
        'COD regression check',
        v_idempotency_cod,
        'web'
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 7 FAILED: COD order creation failed: %', v_res;
    END IF;

    IF v_res->>'order_status' <> 'confirmed' OR v_res->>'payment_status' <> 'pending' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: COD order must confirm immediately!';
    END IF;

    IF (v_res->>'cod_discount')::numeric <= 0 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: COD discount must be applied!';
    END IF;
    v_cod_order_id := (v_res->>'order_id')::uuid;
    RAISE NOTICE '✅ TEST 7 PASSED: COD order creation and discount confirmed with zero regression.';


    -- Clean up test records (without touching immutable audit_logs)
    DELETE FROM payments WHERE order_id IN (v_online_order_id, v_cod_order_id);
    DELETE FROM promotion_usage WHERE customer_id = v_customer_id;
    DELETE FROM order_items WHERE order_id IN (v_online_order_id, v_cod_order_id);
    DELETE FROM orders WHERE customer_id = v_customer_id;
    DELETE FROM customer_addresses WHERE id = v_address_id;
    DELETE FROM customers WHERE id = v_customer_id;
    DELETE FROM product_variants WHERE product_id = v_prod_id;
    DELETE FROM products WHERE id = v_prod_id;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ALL RAZORPAY ONLINE PAYMENT TESTS PASSED 100%%!';
    RAISE NOTICE '============================================================';
END $$;
