-- =============================================================================
-- SABJIWALA: COMPREHENSIVE WAREHOUSE PACKING & THERMAL STICKER TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Customer & Staff
    v_user_cust UUID := gen_random_uuid();
    v_phone_cust VARCHAR(20) := '+9197' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    v_customer_id UUID := gen_random_uuid();
    v_address_id UUID := gen_random_uuid();

    v_user_staff1 UUID := gen_random_uuid();
    v_user_staff2 UUID := gen_random_uuid();
    v_user_mgr UUID := gen_random_uuid();

    -- Products & Variants
    v_unit_kg UUID;
    v_unit_bunch UUID;
    v_prod_tomato UUID := '33333333-0000-0000-0000-000000000001'::uuid;
    v_prod_coriander UUID := '33333333-0000-0000-0000-000000000002'::uuid;
    v_var_tomato_1kg UUID := '44444444-0000-0000-0000-000000000001'::uuid;
    v_var_coriander_bunch UUID := '44444444-0000-0000-0000-000000000002'::uuid;

    -- Orders Created
    v_order1_id UUID;
    v_order2_id UUID;
    v_order1_number VARCHAR(30);
    v_order2_number VARCHAR(30);

    -- Results & Variables
    v_res JSONB;
    v_item_tomato_id UUID;
    v_item_coriander_id UUID;
    v_bag1 RECORD;
    v_bag2 RECORD;
    v_bag3 RECORD;
    v_bag_other RECORD;
    v_order RECORD;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING WAREHOUSE PACKING & THERMAL STICKER TEST SUITE';
    RAISE NOTICE '============================================================';

    -- 1. Setup Test Users & Staff Profiles
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES 
        (v_user_cust, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone_cust || '@test.app', v_phone_cust, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_staff1, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'packer1@sabjiwala.test', '+919800000001', 'hash', now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_staff2, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'packer2@sabjiwala.test', '+919800000002', 'hash', now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user_mgr, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'manager@sabjiwala.test', '+919800000003', 'hash', now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    INSERT INTO customers (id, auth_user_id, full_name, mobile, is_verified, verified_at, verified_sequence, is_active)
    VALUES (v_customer_id, v_user_cust, 'Packing Test Customer', v_phone_cust, true, now(), 18, true);

    INSERT INTO customer_addresses (id, customer_id, address_type, flat_house_no, society_street_name, landmark, area_locality, city, district, state, pincode, is_default, is_deleted)
    VALUES (v_address_id, v_customer_id, 'home', 'B-102', 'Shreeji Residency', 'Near Halol Station', 'Station Road', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false);

    -- Setup Staff User Profiles & Roles
    INSERT INTO user_profiles (id, full_name, mobile, email, is_active)
    VALUES 
        (v_user_staff1, 'Ramesh Packer', '+919800000001', 'packer1@sabjiwala.test', true),
        (v_user_staff2, 'Suresh Packer', '+919800000002', 'packer2@sabjiwala.test', true),
        (v_user_mgr, 'Mahesh Manager', '+919800000003', 'manager@sabjiwala.test', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_roles (user_id, role)
    VALUES 
        (v_user_staff1, 'packing'::staff_role_type),
        (v_user_staff2, 'packing'::staff_role_type),
        (v_user_mgr, 'manager'::staff_role_type)
    ON CONFLICT DO NOTHING;

    -- 2. Setup Test Products & Variants
    SELECT id INTO v_unit_kg FROM product_units WHERE code = 'kg' LIMIT 1;
    SELECT id INTO v_unit_bunch FROM product_units WHERE code = 'bunch' LIMIT 1;

    INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, is_in_stock, is_active)
    VALUES 
        (v_prod_tomato, (SELECT id FROM categories LIMIT 1), v_unit_kg, 'pack-test-tomato', 'Fresh Tomato', 'તાજા ટામેટાં', true, true),
        (v_prod_coriander, (SELECT id FROM categories LIMIT 1), v_unit_bunch, 'pack-test-coriander', 'Fresh Coriander', 'લીલી કોથમીર', true, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        (v_var_tomato_1kg, v_prod_tomato, v_unit_kg, 'SKU-PKT-1KG', '1kg Pack', '૧ કિલો', 1.000, 45.00, 28.00, true),
        (v_var_coriander_bunch, v_prod_coriander, v_unit_bunch, 'SKU-PKC-1BUN', '1 Bunch', '૧ ઝૂડી', 1.000, 20.00, 10.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = EXCLUDED.selling_price, is_active = true;

    -- 3. Create Test Order 1 (Total: 4x 1kg Tomato @ ₹45 + 3x Coriander @ ₹20 = ₹240.00 > ₹200 min)
    PERFORM set_config('request.jwt.claim.sub', v_user_cust::text, true);
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_tomato_1kg, 'quantity', 4),
            jsonb_build_object('variant_id', v_var_coriander_bunch, 'quantity', 3)
        ),
        'Handle tomatoes carefully',
        'PACK-ORD-01',
        'web'
    ) INTO v_res;
    v_order1_id := (v_res->>'order_id')::uuid;

    SELECT order_number INTO v_order1_number FROM orders WHERE id = v_order1_id;

    -- Create Test Order 2 (for wrong bag scan test)
    SELECT create_customer_order(
        v_address_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_tomato_1kg, 'quantity', 5)
        ),
        'Order 2 for wrong bag test',
        'PACK-ORD-02',
        'web'
    ) INTO v_res;
    v_order2_id := (v_res->>'order_id')::uuid;
    SELECT order_number INTO v_order2_number FROM orders WHERE id = v_order2_id;


    -- =========================================================================
    -- TEST 1: Start Packing & Concurrency Collision Protection
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Testing start packing and worker collision lock...';
    
    -- Worker 1 starts packing
    SELECT start_order_packing(v_order1_id, v_user_staff1, 'Ramesh Packer', 'pack-station-1', false) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Worker 1 could not start packing: %', v_res;
    END IF;

    -- Worker 2 tries to pack same order without override -> Should be rejected
    SELECT start_order_packing(v_order1_id, v_user_staff2, 'Suresh Packer', 'pack-station-2', false) INTO v_res;
    IF (v_res->>'success')::boolean IS TRUE OR v_res->>'error_code' <> 'ORDER_LOCKED_BY_OTHER' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected ORDER_LOCKED_BY_OTHER collision rejection, got %', v_res;
    END IF;

    -- Worker 2 uses force override -> Succeeded
    SELECT start_order_packing(v_order1_id, v_user_staff2, 'Suresh Packer', 'pack-station-2', true) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Force override failed: %', v_res;
    END IF;
    RAISE NOTICE '✅ TEST 1 PASSED: Start packing & concurrency locking verified.';


    -- =========================================================================
    -- TEST 2: Item Checklist & Weight Updates
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Testing item packed confirmation and actual weight recording...';
    
    SELECT id INTO v_item_tomato_id FROM order_items WHERE order_id = v_order1_id AND product_id = v_prod_tomato LIMIT 1;
    SELECT id INTO v_item_coriander_id FROM order_items WHERE order_id = v_order1_id AND product_id = v_prod_coriander LIMIT 1;

    -- Update Tomato: Ordered 4.000 kg, Actual Packed 3.980 kg
    SELECT update_order_item_packed_status(v_item_tomato_id, 3.980, true, 'Fresh stock', v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'is_packed_confirmed')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Item 1 confirmation failed: %', v_res;
    END IF;

    -- Confirm Coriander: 3 bunches
    SELECT update_order_item_packed_status(v_item_coriander_id, 3.000, true, 'Good bunches', v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'is_packed_confirmed')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Item 2 confirmation failed: %', v_res;
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Item checklist and weight tracking verified.';


    -- =========================================================================
    -- TEST 3: Multi-Bag Allocation & Unique Constraint
    -- Order requires 2 bags: Bag 1/2 and Bag 2/2
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Testing multi-bag allocation (2 bags)...';
    SELECT set_order_bag_count(v_order1_id, 2, v_user_staff2, false) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'total_bags_count')::int <> 2 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Setting bag count failed: %', v_res;
    END IF;

    SELECT * INTO v_bag1 FROM packing_bags WHERE order_id = v_order1_id AND bag_sequence = 1;
    SELECT * INTO v_bag2 FROM packing_bags WHERE order_id = v_order1_id AND bag_sequence = 2;

    IF v_bag1.id IS NULL OR v_bag2.id IS NULL THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Both bags must exist in packing_bags!';
    END IF;

    IF v_bag1.bag_barcode <> (v_order1_number || '-B01') OR v_bag2.bag_barcode <> (v_order1_number || '-B02') THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Barcode format mismatch (% vs %)', v_bag1.bag_barcode, v_bag2.bag_barcode;
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Multi-bag generation and barcodes verified.';


    -- =========================================================================
    -- TEST 4: Print Job Queueing & Reprint Tracking
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Testing label printing and reprint audit...';
    
    -- Print initial labels
    SELECT queue_bag_sticker_print_job(v_order1_id, NULL, false, NULL, v_user_staff2, 'idemp-print-1') INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Print job queue failed: %', v_res;
    END IF;

    -- Reprint with reason
    SELECT queue_bag_sticker_print_job(v_order1_id, v_bag1.id, true, 'Sticker Damaged', v_user_staff2, 'idemp-reprint-1') INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Reprint job queue failed: %', v_res;
    END IF;

    -- Verify reprint stats on bag 1
    SELECT * INTO v_bag1 FROM packing_bags WHERE id = v_bag1.id;
    IF v_bag1.reprint_count <> 1 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Expected reprint_count = 1, got %', v_bag1.reprint_count;
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Print queueing & reprint auditing verified.';


    -- =========================================================================
    -- TEST 5: Barcode Scanning & Verification Gate
    -- =========================================================================
    RAISE NOTICE '[TEST 5] Testing barcode scanner verification and error detection...';
    
    -- Initialize Bag for Order 2 (to simulate wrong bag scan)
    SELECT start_order_packing(v_order2_id, v_user_staff1, 'Ramesh Packer', 'station-1', false) INTO v_res;
    SELECT * INTO v_bag_other FROM packing_bags WHERE order_id = v_order2_id AND bag_sequence = 1;

    -- Scan wrong bag (from Order 2 while packing Order 1) -> Must be REJECTED!
    SELECT verify_scanned_packing_bag(v_order1_id, v_bag_other.bag_barcode, v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS TRUE OR v_res->>'error_code' <> 'WRONG_BAG_SCANNED' THEN
        RAISE EXCEPTION 'TEST 5A FAILED: Expected WRONG_BAG_SCANNED rejection, got %', v_res;
    END IF;

    -- Scan correct Bag 1 of Order 1 -> Must SUCCEED
    SELECT verify_scanned_packing_bag(v_order1_id, v_bag1.bag_barcode, v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'all_bags_verified')::boolean IS TRUE THEN
        RAISE EXCEPTION 'TEST 5B FAILED: Bag 1 scan failed (expected 1 of 2 verified): %', v_res;
    END IF;

    -- Scan Bag 1 again (Duplicate) -> Must report BAG_ALREADY_VERIFIED
    SELECT verify_scanned_packing_bag(v_order1_id, v_bag1.bag_barcode, v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS TRUE OR v_res->>'error_code' <> 'BAG_ALREADY_VERIFIED' THEN
        RAISE EXCEPTION 'TEST 5C FAILED: Expected BAG_ALREADY_VERIFIED rejection, got %', v_res;
    END IF;

    -- Attempt to mark ready prematurely (Bag 2 still unverified) -> Must be REJECTED!
    SELECT mark_order_ready_for_delivery(v_order1_id, v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS TRUE OR v_res->>'error_code' <> 'UNVERIFIED_BAGS_REMAINING' THEN
        RAISE EXCEPTION 'TEST 5D FAILED: Expected UNVERIFIED_BAGS_REMAINING rejection, got %', v_res;
    END IF;

    -- Scan Bag 2 of Order 1 -> All bags now verified!
    SELECT verify_scanned_packing_bag(v_order1_id, v_bag2.bag_barcode, v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'all_bags_verified')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 5E FAILED: Bag 2 scan failed (expected all bags verified): %', v_res;
    END IF;
    RAISE NOTICE '✅ TEST 5 PASSED: Scanner verification, wrong-bag rejection, duplicate prevention verified.';


    -- =========================================================================
    -- TEST 6: Atomic Completion Gate
    -- =========================================================================
    RAISE NOTICE '[TEST 6] Testing final mark ready for delivery completion gate...';
    
    SELECT mark_order_ready_for_delivery(v_order1_id, v_user_staff2) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Mark ready failed: %', v_res;
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_order1_id;
    IF v_order.order_status <> 'packed' OR v_order.packing_status <> 'verified' THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Order status mismatch (% vs %)', v_order.order_status, v_order.packing_status;
    END IF;
    RAISE NOTICE '✅ TEST 6 PASSED: Order successfully marked packed and ready for delivery.';


    -- =========================================================================
    -- TEST 7: Packing Problem Reporting & Manager Resolution
    -- =========================================================================
    RAISE NOTICE '[TEST 7] Testing packing problem reporting & manager resolution...';
    
    -- Report Problem on Order 2
    SELECT report_order_packing_problem(v_order2_id, 'damaged_stock', 'Tomatoes crushed in transit', v_user_staff1) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 7A FAILED: Reporting problem failed: %', v_res;
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_order2_id;
    IF v_order.packing_status <> 'problem' THEN
        RAISE EXCEPTION 'TEST 7A FAILED: Expected packing_status = problem, got %', v_order.packing_status;
    END IF;

    -- Manager Resolves Problem
    SELECT resolve_order_packing_problem(v_order2_id, 'Replaced with fresh crate from cold room', 'packing', v_user_mgr) INTO v_res;
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 7B FAILED: Resolving problem failed: %', v_res;
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_order2_id;
    IF v_order.packing_status <> 'packing' THEN
        RAISE EXCEPTION 'TEST 7B FAILED: Expected packing_status = packing after resolution, got %', v_order.packing_status;
    END IF;
    RAISE NOTICE '✅ TEST 7 PASSED: Packing problem reporting and manager resolution verified.';


    -- Cleanup test records (without touching immutable audit_logs)
    DELETE FROM print_jobs WHERE order_id IN (v_order1_id, v_order2_id);
    DELETE FROM packing_bags WHERE order_id IN (v_order1_id, v_order2_id);
    DELETE FROM order_items WHERE order_id IN (v_order1_id, v_order2_id);
    DELETE FROM promotion_usage WHERE order_id IN (v_order1_id, v_order2_id);
    DELETE FROM orders WHERE id IN (v_order1_id, v_order2_id);
    DELETE FROM customer_addresses WHERE id = v_address_id;
    DELETE FROM customers WHERE id = v_customer_id;
    DELETE FROM user_roles WHERE user_id IN (v_user_staff1, v_user_staff2, v_user_mgr);
    DELETE FROM user_profiles WHERE id IN (v_user_staff1, v_user_staff2, v_user_mgr);
    DELETE FROM product_variants WHERE product_id IN (v_prod_tomato, v_prod_coriander);
    DELETE FROM products WHERE id IN (v_prod_tomato, v_prod_coriander);

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ALL WAREHOUSE PACKING & STICKER TESTS PASSED 100%%!';
    RAISE NOTICE '============================================================';
END $$;
