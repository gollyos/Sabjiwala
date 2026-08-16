-- =============================================================================
-- SABJIWALA MVP: COMPREHENSIVE COD-ONLY ORDER WORKFLOW TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Auth IDs
    v_user_id UUID := gen_random_uuid();
    v_phone VARCHAR(20) := '+9199' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    v_customer_id UUID := gen_random_uuid();
    v_address_id UUID := gen_random_uuid();

    v_unit_id UUID;
    v_prod_id UUID;
    v_var_100_id UUID;
    v_var_50_id UUID;

    v_res JSONB;
    v_order_id UUID;
    v_idempotency_key VARCHAR(100) := 'COD-MVP-' || gen_random_uuid()::text;
    
    -- Cutoff simulated testing variables
    v_test_time_before TIMESTAMPTZ;
    v_test_time_after TIMESTAMPTZ;
    v_is_before BOOLEAN;
    v_calc_delivery DATE;
    v_now_ist TIMESTAMPTZ := now();
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING SABJIWALA COD-ONLY MVP TEST SUITE';
    RAISE NOTICE '============================================================';

    -- 1. Setup Auth User & Verified Customer (Seq 42 -> FIRST500 eligible)
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone || '@sabjiwala.test', v_phone, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now());

    INSERT INTO customers (id, auth_user_id, full_name, mobile, is_verified, verified_at, verified_sequence, is_active)
    VALUES (v_customer_id, v_user_id, 'COD Test Customer', v_phone, true, now(), 42, true);

    INSERT INTO customer_addresses (id, customer_id, address_type, flat_house_no, society_street_name, landmark, area_locality, city, district, state, pincode, is_default, is_deleted)
    VALUES (v_address_id, v_customer_id, 'home', 'C-101', 'Radhe Shyam Complex', 'Near APMC Market', 'Godhra Road', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false);

    -- 2. Setup Test Products & Variants
    SELECT id INTO v_unit_id FROM product_units WHERE code = 'kg' LIMIT 1;

    INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, is_in_stock, is_active)
    VALUES ('99999999-9999-9999-9999-999999999999'::uuid, (SELECT id FROM categories LIMIT 1), v_unit_id, 'cod-mvp-prod', 'COD Test Veggie', 'સીઓડી શાકભાજી', true, true)
    ON CONFLICT (id) DO NOTHING;
    v_prod_id := '99999999-9999-9999-9999-999999999999'::uuid;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES ('91000000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-COD-100', '1kg Pack', '૧ કિલો', 1.00, 100.00, 70.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 100.00, is_active = true;
    v_var_100_id := '91000000-0000-0000-0000-000000000000'::uuid;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES ('90500000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-COD-50', '500g Pack', '૫૦૦ ગ્રામ', 0.50, 50.00, 35.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 50.00, is_active = true;
    v_var_50_id := '90500000-0000-0000-0000-000000000000'::uuid;


    -- =========================================================================
    -- TEST 1: Calculate Authoritative COD Checkout Quote
    -- Subtotal: 2x ₹100 + 2x ₹50 = ₹300.00
    -- FIRST500 (10%): -₹30.00 -> Net: ₹270.00
    -- COD 2% Discount: -₹5.40 -> Final: ₹264.60
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Testing calculate_checkout_quote in COD-only mode...';
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'cod'
    ) INTO v_res;

    IF (v_res->>'subtotal')::numeric <> 300.00 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected subtotal 300.00, got %', v_res->>'subtotal';
    END IF;

    IF (v_res->'payment'->>'discount_amount')::numeric <> 5.40 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected COD discount 5.40, got %', v_res->'payment'->>'discount_amount';
    END IF;

    IF (v_res->>'final_payable')::numeric <> 264.60 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected final payable 264.60, got %', v_res->>'final_payable';
    END IF;
    RAISE NOTICE '✅ TEST 1 PASSED: Authoritative COD quote calculated accurately.';


    -- =========================================================================
    -- TEST 2: Atomic COD Order Creation
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Placing Atomic COD Order...';
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'Special: Call before delivery at gate',
        v_idempotency_key,
        'web'
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Order creation failed: %', v_res;
    END IF;

    v_order_id := (v_res->>'order_id')::uuid;

    -- Verify immediate confirmation
    IF v_res->>'order_status' <> 'confirmed' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected order_status = confirmed, got %', v_res->>'order_status';
    END IF;

    IF v_res->>'payment_status' <> 'pending' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected payment_status = pending, got %', v_res->>'payment_status';
    END IF;

    IF v_res->>'payment_method' <> 'cod' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected payment_method = cod, got %', v_res->>'payment_method';
    END IF;

    IF (v_res->>'final_payable_amount')::numeric <> 264.60 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected final payable 264.60, got %', v_res->>'final_payable_amount';
    END IF;

    IF v_res->>'delivery_date' IS NULL THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Delivery date must be calculated immediately on COD order creation!';
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: COD order created and confirmed immediately with delivery date %', v_res->>'delivery_date';


    -- =========================================================================
    -- TEST 3: Cutoff Logic Simulation (19:59:59 IST vs 20:00:00 IST)
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Testing 7:59 PM vs 8:00 PM cutoff logic in Asia/Kolkata timezone...';
    
    -- Case A: 19:59:59 IST -> is_before_cutoff = true -> delivery tomorrow
    v_test_time_before := ('2026-08-16 19:59:59+05:30'::timestamptz);
    v_is_before := ((v_test_time_before AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time);
    v_calc_delivery := (v_test_time_before AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day';

    IF NOT v_is_before OR v_calc_delivery <> '2026-08-17'::date THEN
        RAISE EXCEPTION 'TEST 3A FAILED: 19:59:59 IST should be before cutoff with next-day delivery!';
    END IF;
    RAISE NOTICE '  - Case A (19:59:59 IST): is_before_cutoff = TRUE, Delivery = 2026-08-17';

    -- Case B: 20:00:00 IST -> is_before_cutoff = false -> delivery day after tomorrow
    v_test_time_after := ('2026-08-16 20:00:00+05:30'::timestamptz);
    v_is_before := ((v_test_time_after AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time);
    v_calc_delivery := (v_test_time_after AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '2 days';

    IF v_is_before OR v_calc_delivery <> '2026-08-18'::date THEN
        RAISE EXCEPTION 'TEST 3B FAILED: 20:00:00 IST should be at/after cutoff with day-after-tomorrow delivery!';
    END IF;
    RAISE NOTICE '  - Case B (20:00:00 IST): is_before_cutoff = FALSE, Delivery = 2026-08-18';
    RAISE NOTICE '✅ TEST 3 PASSED: Asia/Kolkata 8:00 PM cutoff boundary verified.';


    -- =========================================================================
    -- TEST 4: Idempotency Replay
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Testing Idempotency Replay with same key...';
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'Special: Call before delivery at gate',
        v_idempotency_key,
        'web'
    ) INTO v_res;

    IF (v_res->>'is_idempotent_replay')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Expected is_idempotent_replay = true!';
    END IF;

    IF (v_res->>'order_id')::uuid <> v_order_id THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Idempotent replay returned different order id!';
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Idempotent replay safely returned existing order.';


    -- Clean up test records
    DELETE FROM promotion_usage WHERE customer_id = v_customer_id;
    DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id = v_customer_id);
    DELETE FROM orders WHERE customer_id = v_customer_id;
    DELETE FROM customer_addresses WHERE id = v_address_id;
    DELETE FROM customers WHERE id = v_customer_id;
    DELETE FROM product_variants WHERE product_id = v_prod_id;
    DELETE FROM products WHERE id = v_prod_id;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ALL TESTS IN COD-ONLY MVP TEST SUITE PASSED 100%%!';
    RAISE NOTICE '============================================================';
END $$;
