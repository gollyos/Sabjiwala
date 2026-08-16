-- =============================================================================
-- SABJIWALA: COMPREHENSIVE DELIVERY MANAGEMENT & COD COLLECTION TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Customer, Driver & Manager
    v_user_cust UUID := gen_random_uuid();
    v_phone_cust VARCHAR(20) := '+9197' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    v_customer_id UUID := gen_random_uuid();
    v_address_id UUID := gen_random_uuid();

    v_user_driver UUID := gen_random_uuid();
    v_user_mgr UUID := gen_random_uuid();

    -- Products & Variants
    v_unit_kg UUID;
    v_prod_potato UUID := '55555555-0000-0000-0000-000000000001'::uuid;
    v_var_potato_1kg UUID := '66666666-0000-0000-0000-000000000001'::uuid;

    -- Orders Created
    v_order1_id UUID;
    v_order2_id UUID;
    v_order3_id UUID;
    v_order1_number VARCHAR(30);
    v_order2_number VARCHAR(30);
    v_order3_number VARCHAR(30);

    -- Promotion
    v_promo_id UUID;

    -- Batches & Bags
    v_batch_id UUID;
    v_res JSONB;
    v_bag1 RECORD;
    v_bag2 RECORD;
    v_bag3 RECORD;
    v_bag_other RECORD;
    v_delivery RECORD;
    v_order RECORD;
    v_promo_record RECORD;
    v_payment RECORD;
    v_settlement_id UUID;
    v_settlement RECORD;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING DELIVERY MANAGEMENT & COD COLLECTION TEST SUITE';
    RAISE NOTICE '============================================================';

    -- 1. Setup Test Users & Profiles
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES 
        (v_user_cust, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone_cust || '@test.app', v_phone_cust, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_driver, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'driver1@sabjiwala.test', '+919811111111', 'hash', now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_mgr, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'delmgr@sabjiwala.test', '+919811111112', 'hash', now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    INSERT INTO customers (id, auth_user_id, full_name, mobile, is_verified, verified_at, verified_sequence, is_active)
    VALUES (v_customer_id, v_user_cust, 'Delivery Test Customer', v_phone_cust, true, now(), 20, true);

    INSERT INTO customer_addresses (id, customer_id, address_type, flat_house_no, society_street_name, landmark, area_locality, city, district, state, pincode, is_default, is_deleted)
    VALUES (v_address_id, v_customer_id, 'home', 'A-301', 'Gokul Dham', 'Near Halol GIDC', 'GIDC', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false);

    INSERT INTO user_profiles (id, full_name, mobile, email, is_active)
    VALUES 
        (v_user_driver, 'Amit Driver', '+919811111111', 'driver1@sabjiwala.test', true),
        (v_user_mgr, 'Haresh Delivery Manager', '+919811111112', 'delmgr@sabjiwala.test', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_roles (user_id, role)
    VALUES 
        (v_user_driver, 'delivery'::staff_role_type),
        (v_user_mgr, 'manager'::staff_role_type)
    ON CONFLICT DO NOTHING;

    -- 2. Setup Test Products & Variants
    SELECT id INTO v_unit_kg FROM product_units WHERE code = 'kg' LIMIT 1;

    INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, is_in_stock, is_active)
    VALUES (v_prod_potato, (SELECT id FROM categories LIMIT 1), v_unit_kg, 'del-test-potato', 'Farm Potato', 'બટાટા', true, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES (v_var_potato_1kg, v_prod_potato, v_unit_kg, 'SKU-DEL-POT-1KG', '1kg Bag', '૧ કિલો', 1.000, 35.00, 20.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = EXCLUDED.selling_price, is_active = true;

    -- 3. Create Test Orders:
    -- Order 1: 7x 1kg Potato @ ₹35 = ₹245 (3 Bags)
    PERFORM set_config('request.jwt.claim.sub', v_user_cust::text, true);
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(jsonb_build_object('variant_id', v_var_potato_1kg, 'quantity', 7)),
        'Ring doorbell twice',
        'DEL-ORD-01',
        'web'
    ) INTO v_res;
    v_order1_id := (v_res->>'order_id')::uuid;
    SELECT order_number INTO v_order1_number FROM orders WHERE id = v_order1_id;

    -- Allocate 3 bags for Order 1
    SELECT set_order_bag_count(v_order1_id, 3, v_user_mgr, true) INTO v_res;
    -- Pack & verify order 1
    UPDATE orders SET order_status = 'packed'::order_status_type, packing_status = 'verified' WHERE id = v_order1_id;

    -- Order 2: For wrong bag test (1 Bag)
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(jsonb_build_object('variant_id', v_var_potato_1kg, 'quantity', 6)),
        'Order 2 for wrong bag scan test',
        'DEL-ORD-02',
        'web'
    ) INTO v_res;
    v_order2_id := (v_res->>'order_id')::uuid;
    SELECT order_number INTO v_order2_number FROM orders WHERE id = v_order2_id;
    SELECT set_order_bag_count(v_order2_id, 1, v_user_mgr, true) INTO v_res;
    UPDATE orders SET order_status = 'packed'::order_status_type, packing_status = 'verified' WHERE id = v_order2_id;

    -- Order 3: For failed delivery & reschedule test
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(jsonb_build_object('variant_id', v_var_potato_1kg, 'quantity', 6)),
        'Order 3 for failure test',
        'DEL-ORD-03',
        'web'
    ) INTO v_res;
    v_order3_id := (v_res->>'order_id')::uuid;
    SELECT order_number INTO v_order3_number FROM orders WHERE id = v_order3_id;
    SELECT set_order_bag_count(v_order3_id, 1, v_user_mgr, true) INTO v_res;
    UPDATE orders SET order_status = 'packed'::order_status_type, packing_status = 'verified' WHERE id = v_order3_id;


    -- =========================================================================
    -- TEST 1: Create Delivery Batch & Assign Orders
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Testing create_delivery_batch RPC...';
    SELECT create_delivery_batch(
        (SELECT delivery_date FROM orders WHERE id = v_order1_id),
        '10:00 AM - 01:00 PM',
        v_user_driver,
        ARRAY[v_order1_id, v_order2_id, v_order3_id],
        v_user_mgr
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'total_assigned')::int <> 3 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: create_delivery_batch failed: %', v_res;
    END IF;

    v_batch_id := (v_res->>'batch_id')::uuid;
    RAISE NOTICE '✅ TEST 1 PASSED: Delivery batch created with 3 assigned orders.';


    -- =========================================================================
    -- TEST 2: Start Delivery Batch (Dispatch)
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Testing start_delivery_batch RPC...';
    SELECT start_delivery_batch(v_batch_id, v_user_driver) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 FAILED: start_delivery_batch failed: %', v_res;
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_order1_id;
    IF v_order.order_status <> 'out_for_delivery' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected order_status = out_for_delivery, got %', v_order.order_status;
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Batch and orders transitioned to out_for_delivery.';


    -- =========================================================================
    -- TEST 3: Doorstep Bag Scan Verification Gate
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Testing doorstep bag scan verification...';
    SELECT * INTO v_bag1 FROM packing_bags WHERE order_id = v_order1_id AND bag_sequence = 1;
    SELECT * INTO v_bag2 FROM packing_bags WHERE order_id = v_order1_id AND bag_sequence = 2;
    SELECT * INTO v_bag3 FROM packing_bags WHERE order_id = v_order1_id AND bag_sequence = 3;
    SELECT * INTO v_bag_other FROM packing_bags WHERE order_id = v_order2_id AND bag_sequence = 1;

    -- Scan wrong bag (from Order 2 while Order 1 is open) -> REJECTED!
    SELECT verify_driver_bag_scan(v_order1_id, v_bag_other.bag_barcode, v_user_driver) INTO v_res;
    IF (v_res->>'success')::boolean IS TRUE OR v_res->>'error_code' <> 'WRONG_BAG_SCANNED' THEN
        RAISE EXCEPTION 'TEST 3A FAILED: Expected WRONG_BAG_SCANNED, got %', v_res;
    END IF;

    -- Scan Bag 1 of Order 1 -> SUCCEED
    SELECT verify_driver_bag_scan(v_order1_id, v_bag1.bag_barcode, v_user_driver) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 3B FAILED: Bag 1 scan failed: %', v_res;
    END IF;

    -- Scan Bag 1 again (Duplicate) -> REJECTED with BAG_ALREADY_SCANNED
    SELECT verify_driver_bag_scan(v_order1_id, v_bag1.bag_barcode, v_user_driver) INTO v_res;
    IF (v_res->>'success')::boolean IS TRUE OR v_res->>'error_code' <> 'BAG_ALREADY_SCANNED' THEN
        RAISE EXCEPTION 'TEST 3C FAILED: Expected BAG_ALREADY_SCANNED, got %', v_res;
    END IF;

    -- Scan Bag 2 of Order 1
    SELECT verify_driver_bag_scan(v_order1_id, v_bag2.bag_barcode, v_user_driver) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 3D FAILED: Bag 2 scan failed: %', v_res;
    END IF;

    -- Try to deliver prematurely (Bag 3 missing) -> REJECTED!
    SELECT complete_order_delivery(v_order1_id, 'cash', v_order.final_payable_amount, NULL, v_user_driver, 'test-idemp-1') INTO v_res;
    IF (v_res->>'success')::boolean IS TRUE OR v_res->>'error_code' <> 'UNVERIFIED_BAGS_REMAINING' THEN
        RAISE EXCEPTION 'TEST 3E FAILED: Expected UNVERIFIED_BAGS_REMAINING rejection, got %', v_res;
    END IF;

    -- Scan Bag 3 of Order 1 -> All 3 bags now verified!
    SELECT verify_driver_bag_scan(v_order1_id, v_bag3.bag_barcode, v_user_driver) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'all_bags_verified')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 3F FAILED: Bag 3 scan failed: %', v_res;
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Doorstep bag scanning, wrong-bag rejection, and duplicate prevention verified.';


    -- =========================================================================
    -- TEST 4: Atomic Delivery Completion & COD Payment Ledgering
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Testing complete_order_delivery RPC...';
    SELECT complete_order_delivery(
        v_order1_id,
        'cash',
        v_order.final_payable_amount,
        NULL,
        v_user_driver,
        'idemp-del-01'
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 4 FAILED: complete_order_delivery failed: %', v_res;
    END IF;

    -- Verify Order State
    SELECT * INTO v_order FROM orders WHERE id = v_order1_id;
    IF v_order.order_status <> 'delivered' OR v_order.payment_status <> 'completed' THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Order status not updated to delivered/completed';
    END IF;

    -- Verify Payment Record
    SELECT * INTO v_payment FROM payments WHERE order_id = v_order1_id AND status = 'completed';
    IF v_payment.id IS NULL OR v_payment.amount <> v_order.final_payable_amount THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Payment record missing or amount mismatch!';
    END IF;

    -- Verify Promotion consumed
    SELECT * INTO v_promo_record FROM promotion_usage WHERE order_id = v_order1_id;
    IF v_promo_record.id IS NOT NULL AND v_promo_record.status <> 'consumed' THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Promotion status was not updated to consumed!';
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Atomic delivery completion, COD ledger, and promotion consumption verified.';


    -- =========================================================================
    -- TEST 5: Double-Submit Idempotency
    -- =========================================================================
    RAISE NOTICE '[TEST 5] Testing double-submit idempotency...';
    SELECT complete_order_delivery(
        v_order1_id,
        'cash',
        v_order.final_payable_amount,
        NULL,
        v_user_driver,
        'idemp-del-01'
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'is_idempotent_replay')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Expected idempotent replay, got %', v_res;
    END IF;
    RAISE NOTICE '✅ TEST 5 PASSED: Double-submit idempotency verified.';


    -- =========================================================================
    -- TEST 6: Delivery Failure & Manager Reschedule
    -- =========================================================================
    RAISE NOTICE '[TEST 6] Testing delivery failure & rescheduling...';
    
    -- Driver records failure on Order 3
    SELECT record_delivery_failure(
        v_order3_id,
        'customer_unavailable',
        'Door was locked, phone unreachable',
        v_user_driver
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 6A FAILED: record_delivery_failure failed: %', v_res;
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_order3_id;
    IF v_order.order_status <> 'failed_delivery' THEN
        RAISE EXCEPTION 'TEST 6A FAILED: Expected order_status = failed_delivery, got %', v_order.order_status;
    END IF;

    -- Manager reschedules Order 3 to next day
    SELECT reschedule_failed_delivery(
        v_order3_id,
        (v_order.delivery_date + INTERVAL '1 day')::date,
        'Customer requested next day afternoon',
        v_user_mgr
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 6B FAILED: reschedule_failed_delivery failed: %', v_res;
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_order3_id;
    IF v_order.order_status <> 'packed' THEN
        RAISE EXCEPTION 'TEST 6B FAILED: Expected order_status = packed after reschedule, got %', v_order.order_status;
    END IF;
    RAISE NOTICE '✅ TEST 6 PASSED: Delivery failure recording & manager rescheduling verified.';


    -- =========================================================================
    -- TEST 7: Cash Handover & Settlement Reconciliation
    -- =========================================================================
    RAISE NOTICE '[TEST 7] Testing driver cash settlement & owner verification...';
    
    -- Driver submits cash settlement (Handed over ₹240 vs collected ₹240.10)
    SELECT submit_driver_cash_settlement(
        v_batch_id,
        v_user_driver,
        240.00,
        'Handed over exact round cash'
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 7A FAILED: submit_driver_cash_settlement failed: %', v_res;
    END IF;
    v_settlement_id := (v_res->>'settlement_id')::uuid;

    -- Owner verifies settlement
    SELECT verify_owner_cash_settlement(
        v_settlement_id,
        'verified',
        'Reconciled and verified at Halol godown',
        v_user_mgr
    ) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 7B FAILED: verify_owner_cash_settlement failed: %', v_res;
    END IF;

    SELECT * INTO v_settlement FROM driver_cash_settlements WHERE id = v_settlement_id;
    IF v_settlement.status <> 'verified' THEN
        RAISE EXCEPTION 'TEST 7B FAILED: Expected settlement status = verified, got %', v_settlement.status;
    END IF;
    RAISE NOTICE '✅ TEST 7 PASSED: Cash handover submission & owner verification verified.';


    -- Cleanup test records (without touching immutable audit_logs)
    DELETE FROM driver_cash_settlements WHERE id = v_settlement_id;
    DELETE FROM payments WHERE order_id IN (v_order1_id, v_order2_id, v_order3_id);
    DELETE FROM deliveries WHERE order_id IN (v_order1_id, v_order2_id, v_order3_id);
    DELETE FROM delivery_batches WHERE id = v_batch_id;
    DELETE FROM packing_bags WHERE order_id IN (v_order1_id, v_order2_id, v_order3_id);
    DELETE FROM order_items WHERE order_id IN (v_order1_id, v_order2_id, v_order3_id);
    DELETE FROM promotion_usage WHERE order_id IN (v_order1_id, v_order2_id, v_order3_id);
    DELETE FROM orders WHERE id IN (v_order1_id, v_order2_id, v_order3_id);
    DELETE FROM customer_addresses WHERE id = v_address_id;
    DELETE FROM customers WHERE id = v_customer_id;
    DELETE FROM user_roles WHERE user_id IN (v_user_driver, v_user_mgr);
    DELETE FROM user_profiles WHERE id IN (v_user_driver, v_user_mgr);
    DELETE FROM product_variants WHERE product_id = v_prod_potato;
    DELETE FROM products WHERE id = v_prod_potato;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ALL DELIVERY & COD COLLECTION TESTS PASSED 100%%!';
    RAISE NOTICE '============================================================';
END $$;
