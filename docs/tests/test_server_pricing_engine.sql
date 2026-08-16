-- =============================================================================
-- SABJIWALA: COMPREHENSIVE SERVER-SIDE PRICING & CART QUOTE TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Customers
    v_user_first500_id UUID := '11111111-aaaa-1111-aaaa-111111111111'::uuid;
    v_user_late_id UUID     := '22222222-bbbb-2222-bbbb-222222222222'::uuid;
    v_user_consumed_id UUID := '33333333-cccc-3333-cccc-333333333333'::uuid;

    v_customer_first500_id UUID := gen_random_uuid();
    v_customer_late_id UUID     := gen_random_uuid();
    v_customer_consumed_id UUID := gen_random_uuid();
    v_address_id UUID           := gen_random_uuid();
    v_dummy_order_id UUID       := gen_random_uuid();

    v_promo_id UUID;
    v_unit_id UUID;
    v_prod_id UUID;
    v_var_100_id UUID;
    v_var_50_id UUID;
    v_var_inactive_id UUID;

    v_quote JSONB;
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'STARTING SERVER-SIDE PRICING ENGINE TEST MATRIX';
    RAISE NOTICE '------------------------------------------------------------';

    -- 1. Setup Auth Users
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES 
        (v_user_first500_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'first500@sabjiwala.test', '+919876580001', 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_late_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'late@sabjiwala.test', '+919876580002', 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_consumed_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'consumed@sabjiwala.test', '+919876580003', 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- 2. Setup Customers directly with verified sequences
    INSERT INTO customers (id, auth_user_id, full_name, mobile, is_verified, verified_at, verified_sequence, is_active)
    VALUES 
        (v_customer_first500_id, v_user_first500_id, 'First500 Customer', '+919876580001', true, now(), 120, true),
        (v_customer_late_id, v_user_late_id, 'Late Customer 501', '+919876580002', true, now(), 501, true),
        (v_customer_consumed_id, v_user_consumed_id, 'Consumed Customer', '+919876580003', true, now(), 250, true)
    ON CONFLICT (mobile) DO NOTHING;

    -- Setup Address for Consumed Customer
    INSERT INTO customer_addresses (id, customer_id, address_type, flat_house_no, society_street_name, landmark, area_locality, city, district, state, pincode, is_default, is_deleted)
    VALUES (v_address_id, v_customer_consumed_id, 'home', 'A-1', 'Station Road', 'Near Bank', 'Halol Town', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false)
    ON CONFLICT DO NOTHING;

    -- Setup Order for Consumed Customer
    INSERT INTO orders (
        id, order_number, customer_id, delivery_address_id, channel, order_status, payment_method, payment_status,
        minimum_order_amount_snapshot, subtotal_amount, first_order_discount, promo_discount, cod_discount,
        delivery_charge, final_payable_amount, total_cost_amount, placed_at, customer_name_snapshot,
        customer_mobile_snapshot, delivery_flat_house_snapshot, delivery_society_street_snapshot,
        delivery_landmark_snapshot, delivery_area_snapshot, delivery_city_snapshot, delivery_district_snapshot,
        delivery_pincode_snapshot, customer_snapshot_json, created_at, updated_at
    ) VALUES (
        v_dummy_order_id, 'ORD-TEST-001', v_customer_consumed_id, v_address_id, 'web', 'confirmed', 'cod', 'completed',
        200.00, 300.00, 30.00, 30.00, 5.40, 0.00, 264.60, 200.00, now(), 'Consumed Customer',
        '+919876580003', 'A-1', 'Station Road', 'Near Bank', 'Halol Town', 'Halol', 'Panchmahal',
        '389350', '{"name":"Consumed Customer"}'::jsonb, now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    -- 3. Setup Promo Usage for Consumed Customer
    SELECT id INTO v_promo_id FROM promotions WHERE promo_code = 'FIRST500' LIMIT 1;
    INSERT INTO promotion_usage (id, promotion_id, customer_id, order_id, status, discount_amount_applied, used_at)
    VALUES (gen_random_uuid(), v_promo_id, v_customer_consumed_id, v_dummy_order_id, 'consumed', 30.00, now())
    ON CONFLICT DO NOTHING;

    -- 4. Setup Test Products and Variants
    SELECT id INTO v_unit_id FROM product_units WHERE code = 'kg' LIMIT 1;

    INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, is_in_stock, is_active)
    VALUES 
        ('99999999-9999-9999-9999-999999999999'::uuid, 
         (SELECT id FROM categories LIMIT 1), 
         v_unit_id, 
         'pricing-test-prod', 
         'Pricing Test Vegetable', 
         'પ્રાઇસીંગ ટેસ્ટ શાક', 
         true, 
         true)
    ON CONFLICT (id) DO NOTHING;
    v_prod_id := '99999999-9999-9999-9999-999999999999'::uuid;

    -- Variant A: Price ₹100.00
    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        ('10000000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-100', '1kg Pack', '૧ કિલો', 1.00, 100.00, 70.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 100.00, is_active = true;
    v_var_100_id := '10000000-0000-0000-0000-000000000000'::uuid;

    -- Variant B: Price ₹50.00
    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        ('50000000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-50', '500g Pack', '૫૦૦ ગ્રામ', 0.50, 50.00, 35.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = 50.00, is_active = true;
    v_var_50_id := '50000000-0000-0000-0000-000000000000'::uuid;

    -- Variant C: Inactive Variant
    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        ('90000000-0000-0000-0000-000000000000'::uuid, v_prod_id, v_unit_id, 'SKU-DIS', 'Disabled Pack', 'બંધ પેક', 1.00, 80.00, 60.00, false)
    ON CONFLICT (id) DO UPDATE SET is_active = false;
    v_var_inactive_id := '90000000-0000-0000-0000-000000000000'::uuid;


    -- =========================================================================
    -- TEST 1: Subtotal < ₹200 (e.g. ₹150) -> minimum_order_met = FALSE
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Testing Subtotal < ₹200 (₹150)...';
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);

    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 1),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 1)
        ),
        'cod'
    ) INTO v_quote;

    IF (v_quote->>'subtotal')::numeric <> 150.00 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected subtotal 150.00, got %', v_quote->>'subtotal';
    END IF;

    IF (v_quote->>'minimum_order_met')::boolean IS NOT FALSE THEN
        RAISE EXCEPTION 'TEST 1 FAILED: minimum_order_met should be false for ₹150 subtotal';
    END IF;

    IF (v_quote->>'remaining_amount_to_minimum')::numeric <> 50.00 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected remaining 50.00, got %', v_quote->>'remaining_amount_to_minimum';
    END IF;
    RAISE NOTICE '✅ TEST 1 PASSED: Subtotal ₹150 correctly rejected (₹50 remaining to minimum).';


    -- =========================================================================
    -- TEST 2: Exact ₹200 Subtotal -> minimum_order_met = TRUE
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Testing Subtotal = ₹200 (2 x ₹100)...';
    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2)
        ),
        'cod'
    ) INTO v_quote;

    IF (v_quote->>'subtotal')::numeric <> 200.00 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected subtotal 200.00, got %', v_quote->>'subtotal';
    END IF;

    IF (v_quote->>'minimum_order_met')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 FAILED: minimum_order_met should be true for ₹200 subtotal';
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Exact ₹200 subtotal accepted.';


    -- =========================================================================
    -- TEST 3: Discount Reduces Total Below ₹200, but Order REMAINS ACCEPTED
    -- Subtotal ₹250, FIRST500 (10%) = ₹25, Remaining = ₹225, COD (2%) = ₹4.50, Total = ₹220.50
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Testing Subtotal ₹250 with FIRST500 and COD discounts for verified customer...';
    PERFORM set_config('request.jwt.claim.sub', v_user_first500_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 1)
        ),
        'cod'
    ) INTO v_quote;

    -- Subtotal: 250.00
    IF (v_quote->>'subtotal')::numeric <> 250.00 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Subtotal should be 250.00, got %', v_quote->>'subtotal';
    END IF;

    -- First500 Discount: 10% of 250 = 25.00
    IF (v_quote->'promotion'->>'discount_amount')::numeric <> 25.00 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: FIRST500 discount should be 25.00, got %', v_quote->'promotion'->>'discount_amount';
    END IF;

    -- COD Discount: 2% of (250 - 25 = 225) = 4.50
    IF (v_quote->'payment'->>'discount_amount')::numeric <> 4.50 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: COD discount should be 4.50, got %', v_quote->'payment'->>'discount_amount';
    END IF;

    -- Final Payable: 250 - 25 - 4.50 = 220.50
    IF (v_quote->>'final_payable')::numeric <> 220.50 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Final payable should be 220.50, got %', v_quote->>'final_payable';
    END IF;

    IF (v_quote->>'minimum_order_met')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Minimum order should be met based on 250 subtotal';
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Deterministic discount stacking (Subtotal 250 -> Promo 25 -> COD 4.50 -> Final 220.50).';


    -- =========================================================================
    -- TEST 4: Online Payment Method (0% Payment Discount)
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Testing Online Payment Method (0%% Payment Discount)...';
    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_50_id, 'quantity', 1)
        ),
        'online'
    ) INTO v_quote;

    -- Payment discount should be 0.00
    IF (v_quote->'payment'->>'discount_amount')::numeric <> 0.00 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Online payment discount should be 0.00, got %', v_quote->'payment'->>'discount_amount';
    END IF;

    -- Final Payable: 250 - 25 - 0 = 225.00
    IF (v_quote->>'final_payable')::numeric <> 225.00 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Online final payable should be 225.00, got %', v_quote->>'final_payable';
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Online payment discount is 0.00 and final payable is 225.00.';


    -- =========================================================================
    -- TEST 5: Customer Sequence > 500 -> Ineligible for FIRST500
    -- =========================================================================
    RAISE NOTICE '[TEST 5] Testing Customer Sequence #501 (Ineligible for FIRST500)...';
    PERFORM set_config('request.jwt.claim.sub', v_user_late_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2)
        ),
        'cod'
    ) INTO v_quote;

    IF (v_quote->'promotion'->>'eligible')::boolean IS NOT FALSE THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Customer #501 should NOT be eligible for FIRST500';
    END IF;

    IF (v_quote->'promotion'->>'discount_amount')::numeric <> 0.00 THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Ineligible customer should get 0.00 promo discount';
    END IF;
    RAISE NOTICE '✅ TEST 5 PASSED: Customer outside first 500 correctly denied launch promo.';


    -- =========================================================================
    -- TEST 6: Customer Already Consumed FIRST500 -> Ineligible for Second Order
    -- =========================================================================
    RAISE NOTICE '[TEST 6] Testing Customer who already consumed FIRST500...';
    PERFORM set_config('request.jwt.claim.sub', v_user_consumed_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2)
        ),
        'cod'
    ) INTO v_quote;

    IF (v_quote->'promotion'->>'eligible')::boolean IS NOT FALSE THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Already consumed customer should NOT be eligible for FIRST500 again';
    END IF;
    RAISE NOTICE '✅ TEST 6 PASSED: Re-usage of FIRST500 strictly prevented.';


    -- =========================================================================
    -- TEST 7: Inactive / Out-of-Stock Item in Cart -> is_available = FALSE
    -- =========================================================================
    RAISE NOTICE '[TEST 7] Testing Inactive Variant in Cart...';
    SELECT calculate_checkout_quote(
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_100_id, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_inactive_id, 'quantity', 1)
        ),
        'cod'
    ) INTO v_quote;

    IF (v_quote->>'has_unavailable_items')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 7 FAILED: has_unavailable_items should be true';
    END IF;
    RAISE NOTICE '✅ TEST 7 PASSED: Inactive variant flagged as unavailable in quote.';


    -- Clean up test records
    DELETE FROM promotion_usage WHERE customer_id = v_customer_consumed_id;
    DELETE FROM orders WHERE id = v_dummy_order_id;
    DELETE FROM customer_addresses WHERE id = v_address_id;
    DELETE FROM customers WHERE id IN (v_customer_first500_id, v_customer_late_id, v_customer_consumed_id);
    DELETE FROM product_variants WHERE product_id = v_prod_id;
    DELETE FROM products WHERE id = v_prod_id;

    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'ALL 7 INTEGRATION TESTS IN PRICING ENGINE SUITE PASSED 100%%!';
    RAISE NOTICE '------------------------------------------------------------';
END $$;
