-- =============================================================================
-- SABJIWALA: COMPREHENSIVE ATOMIC ORDER CREATION INTEGRATION TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Auth IDs
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();

    v_phone_a VARCHAR(20) := '+9199' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    v_phone_b VARCHAR(20) := '+9199' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');

    v_customer_a_id UUID := gen_random_uuid();
    v_customer_b_id UUID := gen_random_uuid();

    v_address_a_id UUID := gen_random_uuid();
    v_address_b_id UUID := gen_random_uuid();

    v_unit_id UUID;
    v_prod_id UUID;
    v_var_100_id UUID;
    v_var_50_id UUID;
    v_var_inactive_id UUID;

    v_res JSONB;
    v_order_id UUID;
    v_idempotency_key VARCHAR(100) := 'IDEM-TEST-' || gen_random_uuid()::text;
    v_error_caught BOOLEAN := false;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING ATOMIC ORDER CREATION INTEGRATION TEST MATRIX';
    RAISE NOTICE '============================================================';

    -- 1. Setup Auth Users
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES 
        (v_user_a_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone_a || '@sabjiwala.test', v_phone_a, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_b_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone_b || '@sabjiwala.test', v_phone_b, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now());

    -- 2. Setup Verified Customers (Customer A: Sequence 50, Customer B: Sequence 600)
    INSERT INTO customers (id, auth_user_id, full_name, mobile, is_verified, verified_at, verified_sequence, is_active)
    VALUES 
        (v_customer_a_id, v_user_a_id, 'Customer Alpha', v_phone_a, true, now(), 50, true),
        (v_customer_b_id, v_user_b_id, 'Customer Beta', v_phone_b, true, now(), 600, true);

    -- 3. Setup Addresses
    INSERT INTO customer_addresses (id, customer_id, address_type, flat_house_no, society_street_name, landmark, area_locality, city, district, state, pincode, is_default, is_deleted)
    VALUES 
        (v_address_a_id, v_customer_a_id, 'home', 'A-101', 'Green City', 'Near Tower', 'Bypass Road', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false),
        (v_address_b_id, v_customer_b_id, 'home', 'B-202', 'Shreeji Krupa', 'Near Bus Stand', 'Station Road', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false);

    -- 4. Setup Test Products & Variants
    SELECT id INTO v_unit_id FROM product_units WHERE code = 'kg' LIMIT 1;

    INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, is_in_stock, is_active)
    VALUES 
        ('88888888-8888-8888-8888-888888888888'::uuid, (SELECT id FROM categories LIMIT 1), v_unit_id, 'order-test-prod', 'Order Test Vegetable', 'ઓર્ડર ટેસ્ટ શાક', true, true)
    ON CONFLICT (id) DO NOTHING;
    v_prod_id := '88888888-8888-8888-8888-888888888888'::uuid;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        ('81000000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-ORD-100', '1kg Pack', '૧ કિલો', 1.00, 100.00, 70.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 100.00, is_active = true;
    v_var_100_id := '81000000-0000-0000-0000-000000000000'::uuid;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        ('80500000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-ORD-50', '500g Pack', '૫૦૦ ગ્રામ', 0.50, 50.00, 35.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 50.00, is_active = true;
    v_var_50_id := '80500000-0000-0000-0000-000000000000'::uuid;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        ('80900000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-ORD-DIS', 'Disabled Pack', 'બંધ પેક', 1.00, 80.00, 60.00, false)
    ON CONFLICT (id) DO UPDATE SET is_active = false;
    v_var_inactive_id := '80900000-0000-0000-0000-000000000000'::uuid;


    -- =========================================================================
    -- TEST 1: Minimum Order Check (< ₹200) -> Rollback & Exception
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Testing subtotal < ₹200 rejected...';
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    v_error_caught := false;
    BEGIN
        PERFORM create_customer_order(
            v_address_a_id,
            'cod',
            jsonb_build_array(jsonb_build_object('variant_id', v_var_100_id, 'quantity', 1)),
            'Subtotal 100 test',
            'IDEM-MIN-FAIL',
            'web'
        );
    EXCEPTION WHEN OTHERS THEN
        v_error_caught := true;
        RAISE NOTICE 'Expected error caught: %', SQLERRM;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Subtotal < 200 was not rejected!';
    END IF;
    RAISE NOTICE '✅ TEST 1 PASSED: Minimum order enforcement rejected subtotal < ₹200.';


    -- =========================================================================
    -- TEST 2: Another Customer Address Tampering -> Rollback & Exception
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Testing unauthorized address access (Customer A trying Customer B address)...';
    v_error_caught := false;
    BEGIN
        PERFORM create_customer_order(
            v_address_b_id, -- Address B belongs to Customer B!
            'cod',
            jsonb_build_array(jsonb_build_object('variant_id', v_var_100_id, 'quantity', 3)),
            'Address tampering test',
            'IDEM-ADDR-FAIL',
            'web'
        );
    EXCEPTION WHEN OTHERS THEN
        v_error_caught := true;
        RAISE NOTICE 'Expected address error caught: %', SQLERRM;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Customer A was able to use Customer B address!';
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Cross-customer address access strictly prevented.';


    -- =========================================================================
    -- TEST 3: Stale Cart Price Detection (PRICE_CHANGED)
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Testing stale price detection...';
    v_error_caught := false;
    BEGIN
        PERFORM create_customer_order(
            v_address_a_id,
            'cod',
            jsonb_build_array(
                jsonb_build_object(
                    'variant_id', v_var_100_id, 
                    'quantity', 3,
                    'expected_unit_price', 80.00 -- True rate is 100.00!
                )
            ),
            'Stale price test',
            'IDEM-PRICE-FAIL',
            'web'
        );
    EXCEPTION WHEN OTHERS THEN
        v_error_caught := true;
        RAISE NOTICE 'Expected PRICE_CHANGED error caught: %', SQLERRM;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Stale price was not detected!';
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: PRICE_CHANGED error triggered on price discrepancy.';


    -- =========================================================================
    -- TEST 4: Normal COD Order with FIRST500 (Sequence 50) + COD 2% Stacking
    -- Subtotal = ₹300, FIRST500 10% = ₹30, Remaining = ₹270, COD 2% = ₹5.40, Final = ₹264.60
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Creating Normal COD Order for Customer A (FIRST500 eligible)...';
    SELECT create_customer_order(
        v_address_a_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'Leave at gate',
        v_idempotency_key,
        'web'
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Order creation failed: %', v_res;
    END IF;

    v_order_id := (v_res->>'order_id')::uuid;

    IF (v_res->>'subtotal')::numeric <> 300.00 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Expected subtotal 300.00, got %', v_res->>'subtotal';
    END IF;

    IF (v_res->>'first_order_discount')::numeric <> 30.00 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Expected promo discount 30.00, got %', v_res->>'first_order_discount';
    END IF;

    IF (v_res->>'cod_discount')::numeric <> 5.40 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Expected COD discount 5.40, got %', v_res->>'cod_discount';
    END IF;

    IF (v_res->>'final_payable_amount')::numeric <> 264.60 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Expected final payable 264.60, got %', v_res->>'final_payable_amount';
    END IF;

    IF (v_res->>'order_status') <> 'confirmed' THEN
        RAISE EXCEPTION 'TEST 4 FAILED: COD order status should be confirmed';
    END IF;

    IF (v_res->>'delivery_date') IS NULL THEN
        RAISE EXCEPTION 'TEST 4 FAILED: COD order must have delivery_date scheduled';
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Order created (Order: %, Total: ₹%).', v_res->>'order_number', v_res->>'final_payable_amount';


    -- =========================================================================
    -- TEST 5: Idempotency (Repeat Request with Same Idempotency Key)
    -- =========================================================================
    RAISE NOTICE '[TEST 5] Testing idempotency replay with same key...';
    SELECT create_customer_order(
        v_address_a_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 2)
        ),
        'Leave at gate',
        v_idempotency_key,
        'web'
    ) INTO v_res;

    IF (v_res->>'is_idempotent_replay')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Expected is_idempotent_replay = true on duplicate request!';
    END IF;

    IF (v_res->>'order_id')::uuid <> v_order_id THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Idempotent replay returned different order id!';
    END IF;
    RAISE NOTICE '✅ TEST 5 PASSED: Idempotency successfully prevented duplicate order.';


    -- =========================================================================
    -- TEST 6: Promotion Lifecycle - Customer A Cannot Use FIRST500 on Second Order
    -- =========================================================================
    RAISE NOTICE '[TEST 6] Testing that Customer A cannot use FIRST500 on second order...';
    SELECT create_customer_order(
        v_address_a_id,
        'cod',
        jsonb_build_array(jsonb_build_object('variant_id', v_var_100_id, 'quantity', 3)),
        'Second order',
        'IDEM-SECOND-ORDER-' || gen_random_uuid()::text,
        'web'
    ) INTO v_res;

    IF (v_res->>'first_order_discount')::numeric <> 0.00 THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Customer A received FIRST500 discount on second order!';
    END IF;
    RAISE NOTICE '✅ TEST 6 PASSED: FIRST500 discount excluded on second order.';


    -- =========================================================================
    -- TEST 7: Online Payment Order - Stays payment_pending & delivery_date IS NULL
    -- =========================================================================
    RAISE NOTICE '[TEST 7] Testing Online Payment Order Creation...';
    PERFORM set_config('request.jwt.claim.sub', v_user_b_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT create_customer_order(
        v_address_b_id,
        'online',
        jsonb_build_array(jsonb_build_object('variant_id', v_var_100_id, 'quantity', 3)),
        'Online UPI Order',
        'IDEM-ONLINE-TEST-' || gen_random_uuid()::text,
        'web'
    ) INTO v_res;

    IF (v_res->>'order_status') <> 'payment_pending' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Online order should have status payment_pending, got %', v_res->>'order_status';
    END IF;

    IF (v_res->>'delivery_date') IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Online order must NOT have delivery_date assigned before payment verification!';
    END IF;
    RAISE NOTICE '✅ TEST 7 PASSED: Online order initialized in payment_pending with null delivery date.';


    -- =========================================================================
    -- TEST 8: Customer Order Details Isolation (Customer B cannot read Customer A order)
    -- =========================================================================
    RAISE NOTICE '[TEST 8] Testing Cross-Customer Order Details Privacy...';
    v_error_caught := false;
    BEGIN
        PERFORM get_my_order_details(v_order_id); -- Customer B tries to view Customer A's order!
    EXCEPTION WHEN OTHERS THEN
        v_error_caught := true;
        RAISE NOTICE 'Expected privacy error caught: %', SQLERRM;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Customer B was able to view Customer A order!';
    END IF;
    RAISE NOTICE '✅ TEST 8 PASSED: Customer privacy strictly enforced on order details.';


    -- Clean up test records
    DELETE FROM promotion_usage WHERE customer_id IN (v_customer_a_id, v_customer_b_id);
    DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (v_customer_a_id, v_customer_b_id));
    DELETE FROM orders WHERE customer_id IN (v_customer_a_id, v_customer_b_id);
    DELETE FROM customer_addresses WHERE id IN (v_address_a_id, v_address_b_id);
    DELETE FROM customers WHERE id IN (v_customer_a_id, v_customer_b_id);
    DELETE FROM product_variants WHERE product_id = v_prod_id;
    DELETE FROM products WHERE id = v_prod_id;
    DELETE FROM auth.users WHERE id IN (v_user_a_id, v_user_b_id);

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ALL 8 INTEGRATION TESTS IN ORDER CREATION SUITE PASSED 100%%!';
    RAISE NOTICE '============================================================';
END $$;
