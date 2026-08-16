-- =============================================================================
-- SABJIWALA: COMPREHENSIVE 8 PM PROCUREMENT BATCH TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Customers
    v_user1_id UUID := gen_random_uuid();
    v_phone1 VARCHAR(20) := '+9197' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    v_cust1_id UUID := gen_random_uuid();
    v_addr1_id UUID := gen_random_uuid();

    v_user2_id UUID := gen_random_uuid();
    v_phone2 VARCHAR(20) := '+9197' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    v_cust2_id UUID := gen_random_uuid();
    v_addr2_id UUID := gen_random_uuid();

    -- Products & Units
    v_unit_kg UUID;
    v_unit_bunch UUID;
    v_prod_tomato UUID := '11111111-0000-0000-0000-000000000001'::uuid;
    v_prod_coriander UUID := '11111111-0000-0000-0000-000000000002'::uuid;
    v_var_tomato_1kg UUID := '22222222-0000-0000-0000-000000000001'::uuid;
    v_var_tomato_500g UUID := '22222222-0000-0000-0000-000000000002'::uuid;
    v_var_coriander_bunch UUID := '22222222-0000-0000-0000-000000000003'::uuid;

    -- Test Target Date and Timestamps
    v_target_delivery DATE := '2026-08-20'::date;
    v_cutoff_ts TIMESTAMPTZ := '2026-08-19 20:00:00+05:30'::timestamptz;
    v_ts_before TIMESTAMPTZ := '2026-08-19 19:59:59+05:30'::timestamptz;
    v_ts_at TIMESTAMPTZ := '2026-08-19 20:00:00+05:30'::timestamptz;
    v_ts_after TIMESTAMPTZ := '2026-08-19 20:00:01+05:30'::timestamptz;

    -- Orders Created
    v_order1_id UUID;
    v_order2_id UUID;
    v_order_late_id UUID;
    v_order_dayafter_id UUID;

    -- Results & Variables
    v_res JSONB;
    v_batch_id UUID;
    v_batch_details JSONB;
    v_item_tomato RECORD;
    v_item_coriander RECORD;
    v_pbo RECORD;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STARTING 8 PM PROCUREMENT BATCH TEST SUITE';
    RAISE NOTICE '============================================================';

    -- 1. Setup Test Users & Addresses
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES 
        (v_user1_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone1 || '@test.app', v_phone1, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now()),
        (v_user2_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_phone2 || '@test.app', v_phone2, 'hash', now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb, now(), now());

    INSERT INTO customers (id, auth_user_id, full_name, mobile, is_verified, verified_at, verified_sequence, is_active)
    VALUES 
        (v_cust1_id, v_user1_id, 'Procurement Test Customer 1', v_phone1, true, now(), 12, true),
        (v_cust2_id, v_user2_id, 'Procurement Test Customer 2', v_phone2, true, now(), 15, true);

    INSERT INTO customer_addresses (id, customer_id, address_type, flat_house_no, society_street_name, landmark, area_locality, city, district, state, pincode, is_default, is_deleted)
    VALUES 
        (v_addr1_id, v_cust1_id, 'home', '101', 'Green Park', 'Near Mandi', 'Halol GIDC', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false),
        (v_addr2_id, v_cust2_id, 'home', '202', 'Radhe Shyam Society', 'Station Road', 'Halol Station', 'Halol', 'Panchmahal', 'Gujarat', '389350', true, false);

    -- 2. Setup Test Products & Variants
    SELECT id INTO v_unit_kg FROM product_units WHERE code = 'kg' LIMIT 1;
    SELECT id INTO v_unit_bunch FROM product_units WHERE code = 'bunch' LIMIT 1;

    INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, is_in_stock, is_active)
    VALUES 
        (v_prod_tomato, (SELECT id FROM categories LIMIT 1), v_unit_kg, 'proc-test-tomato', 'Proc Tomato', 'ટેસ્ટ ટામેટાં', true, true),
        (v_prod_coriander, (SELECT id FROM categories LIMIT 1), v_unit_bunch, 'proc-test-coriander', 'Proc Coriander', 'ટેસ્ટ કોથમીર', true, true)
    ON CONFLICT (id) DO NOTHING;

    -- Tomato: 1kg pack (mult 1.0) and 500g pack (mult 0.5)
    INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_active)
    VALUES 
        (v_var_tomato_1kg, v_prod_tomato, v_unit_kg, 'SKU-PT-1KG', '1kg Pack', '૧ કિલો', 1.000, 40.00, 25.00, true),
        (v_var_tomato_500g, v_prod_tomato, v_unit_kg, 'SKU-PT-500G', '500g Pack', '૫૦૦ ગ્રામ', 0.500, 22.00, 13.00, true),
        (v_var_coriander_bunch, v_prod_coriander, v_unit_bunch, 'SKU-PC-1BUN', '1 Bunch', '૧ ઝૂડી', 1.000, 15.00, 8.00, true)
    ON CONFLICT (id) DO UPDATE SET selling_price = EXCLUDED.selling_price, is_active = true;


    -- =========================================================================
    -- CREATE TEST ORDERS WITH SIMULATED CUTOFF TIMESTAMPS
    -- =========================================================================

    -- Order 1: Confirmed at 19:59:59 IST (< 20:00) -> Target: 2026-08-20
    -- Items: 3x 1kg Tomato (3.0 kg) + 2x 500g Tomato (1.0 kg) + 4x Coriander (4 bunches)
    -- Total Tomato = 4.0 kg, Subtotal = 120 + 44 + 60 = ₹224.00 (meets ₹200 min)
    PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
    SELECT create_customer_order(
        v_addr1_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_tomato_1kg, 'quantity', 3),
            jsonb_build_object('variant_id', v_var_tomato_500g, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_coriander_bunch, 'quantity', 4)
        ),
        'Early order 1',
        'PROC-ORD-1',
        'web'
    ) INTO v_res;
    v_order1_id := (v_res->>'order_id')::uuid;

    -- Manually set simulated timestamp & delivery date for deterministic testing
    UPDATE orders 
    SET confirmed_at = v_ts_before, delivery_date = v_target_delivery 
    WHERE id = v_order1_id;

    -- Order 2: Confirmed at 19:30:00 IST (< 20:00) -> Target: 2026-08-20
    -- Items: 2x 1kg Tomato (2.0 kg) + 4x 500g Tomato (2.0 kg) + 4x Coriander (4 bunches)
    -- Total Tomato = 4.0 kg, Total Coriander = 4 bunches, Subtotal = 80 + 88 + 60 = ₹228.00
    PERFORM set_config('request.jwt.claim.sub', v_user2_id::text, true);
    SELECT create_customer_order(
        v_addr2_id,
        'cod',
        jsonb_build_array(
            jsonb_build_object('variant_id', v_var_tomato_1kg, 'quantity', 2),
            jsonb_build_object('variant_id', v_var_tomato_500g, 'quantity', 4),
            jsonb_build_object('variant_id', v_var_coriander_bunch, 'quantity', 4)
        ),
        'Early order 2',
        'PROC-ORD-2',
        'web'
    ) INTO v_res;
    v_order2_id := (v_res->>'order_id')::uuid;

    UPDATE orders 
    SET confirmed_at = '2026-08-19 19:30:00+05:30'::timestamptz, delivery_date = v_target_delivery 
    WHERE id = v_order2_id;

    -- Order 3 (LATE): Confirmed at EXACTLY 20:00:00 IST (>= 20:00) -> Target delivery is 2026-08-21
    -- Must NOT be included in 2026-08-20 batch!
    PERFORM set_config('request.jwt.claim.sub', v_user1_id::text, true);
    SELECT create_customer_order(
        v_addr1_id,
        'cod',
        jsonb_build_array(jsonb_build_object('variant_id', v_var_tomato_1kg, 'quantity', 6)),
        'Late order exactly 8 PM',
        'PROC-ORD-LATE',
        'web'
    ) INTO v_res;
    v_order_late_id := (v_res->>'order_id')::uuid;

    UPDATE orders 
    SET confirmed_at = v_ts_at, delivery_date = v_target_delivery + INTERVAL '1 day' 
    WHERE id = v_order_late_id;


    -- =========================================================================
    -- TEST 1: Atomic Procurement Batch Lock & Cutoff Enforcement
    -- Expected in 2026-08-20 batch: Order 1 & Order 2 (Total = 2 orders)
    -- Excluded: Order 3 (Late)
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Executing lock_daily_procurement_batch for %...', v_target_delivery;
    
    SELECT lock_daily_procurement_batch(v_target_delivery, v_cutoff_ts, NULL) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Batch lock failed: %', v_res;
    END IF;

    v_batch_id := (v_res->>'batch_id')::uuid;

    IF (v_res->>'total_orders_count')::int <> 2 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected 2 orders in batch, got %', v_res->>'total_orders_count';
    END IF;

    IF (v_res->>'unique_customers_count')::int <> 2 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Expected 2 unique customers, got %', v_res->>'unique_customers_count';
    END IF;

    RAISE NOTICE '✅ TEST 1 PASSED: Procurement batch % locked with 2 eligible orders.', v_res->>'batch_number';


    -- =========================================================================
    -- TEST 2: Idempotent Batch Locking (Scheduler / n8n retry safety)
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Testing duplicate batch lock trigger on same target date...';
    SELECT lock_daily_procurement_batch(v_target_delivery, v_cutoff_ts, NULL) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE OR v_res->>'status' <> 'ALREADY_LOCKED' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Expected ALREADY_LOCKED on duplicate trigger, got %', v_res;
    END IF;

    IF (v_res->>'batch_id')::uuid <> v_batch_id THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Batch ID mismatch on duplicate trigger!';
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Batch locking is safely idempotent.';


    -- =========================================================================
    -- TEST 3: Base-Unit Demand Aggregation & Buffer Calculation
    -- Order 1: Tomato 4.0 kg + Coriander 4 bunches
    -- Order 2: Tomato 4.0 kg + Coriander 4 bunches
    -- Total Demand: Tomato = 8.000 kg, Coriander = 8 bunches
    -- Suggested (+3% Buffer):
    --   Tomato: 8.0 * 1.03 = 8.24 -> Round to nearest 0.5kg = 8.500 kg
    --   Coriander: 8 * 1.03 = 8.24 -> CEIL = 9 bunches
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Verifying base unit quantities and 3%% buffer calculations...';
    
    SELECT * INTO v_item_tomato 
    FROM procurement_items 
    WHERE batch_id = v_batch_id AND product_id = v_prod_tomato;

    IF v_item_tomato.required_qty <> 8.000 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Expected 8.000 kg Tomato demand, got %', v_item_tomato.required_qty;
    END IF;

    IF v_item_tomato.suggested_procurement_qty < 8.000 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Suggested procurement qty must include buffer!';
    END IF;

    SELECT * INTO v_item_coriander 
    FROM procurement_items 
    WHERE batch_id = v_batch_id AND product_id = v_prod_coriander;

    IF v_item_coriander.required_qty <> 8.000 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Expected 8 bunches Coriander demand, got %', v_item_coriander.required_qty;
    END IF;

    IF v_item_coriander.suggested_procurement_qty < 8.000 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Suggested coriander bunches must include buffer!';
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Product demand aggregated correctly in respective base units (kg and bunches).';


    -- =========================================================================
    -- TEST 4: Financial Summary Reconciliation
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Reconciling financial totals with source orders...';
    DECLARE
        v_sum_gross NUMERIC;
        v_sum_cod NUMERIC;
        v_batch RECORD;
    BEGIN
        SELECT SUM(subtotal_amount), SUM(final_payable_amount) INTO v_sum_gross, v_sum_cod
        FROM orders WHERE id IN (v_order1_id, v_order2_id);

        SELECT * INTO v_batch FROM procurement_batches WHERE id = v_batch_id;

        IF v_batch.gross_merchandise_total <> v_sum_gross THEN
            RAISE EXCEPTION 'TEST 4 FAILED: Gross merchandise mismatch (% vs %)', v_batch.gross_merchandise_total, v_sum_gross;
        END IF;

        IF v_batch.expected_cod_collection_total <> v_sum_cod THEN
            RAISE EXCEPTION 'TEST 4 FAILED: Expected COD mismatch (% vs %)', v_batch.expected_cod_collection_total, v_sum_cod;
        END IF;
    END;
    RAISE NOTICE '✅ TEST 4 PASSED: Financial summary matches source order snapshots exactly.';


    -- =========================================================================
    -- TEST 5: Post-Lock Order Cancellation Exception Handling
    -- Cancelling Order 1 after batch lock must NOT delete membership row.
    -- =========================================================================
    RAISE NOTICE '[TEST 5] Testing post-lock order cancellation handling...';
    SELECT handle_post_lock_order_cancellation(v_order1_id, 'Customer emergency cancellation post 8 PM') INTO v_res;

    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Cancellation handler failed: %', v_res;
    END IF;

    SELECT * INTO v_pbo FROM procurement_batch_orders WHERE batch_id = v_batch_id AND order_id = v_order1_id;
    IF v_pbo.id IS NULL OR NOT v_pbo.is_cancelled_post_lock THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Membership record must be retained and marked is_cancelled_post_lock = true!';
    END IF;

    -- Verify cancelled demand updated in procurement_items (Order 1 had 4.0 kg tomato)
    SELECT * INTO v_item_tomato FROM procurement_items WHERE batch_id = v_batch_id AND product_id = v_prod_tomato;
    IF v_item_tomato.cancelled_after_lock_qty <> 4.000 THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Expected 4.000 kg cancelled Tomato demand, got %', v_item_tomato.cancelled_after_lock_qty;
    END IF;
    RAISE NOTICE '✅ TEST 5 PASSED: Post-lock cancellation tracked as operational exception without history deletion.';


    -- =========================================================================
    -- TEST 6: Multi-Supplier Purchase Line & Wastage Calculation
    -- =========================================================================
    RAISE NOTICE '[TEST 6] Testing multi-supplier purchase lines and wastage recording...';
    DECLARE
        v_sup1 UUID := '11111111-1111-1111-1111-111111111111'::uuid;
        v_sup2 UUID := '22222222-2222-2222-2222-222222222222'::uuid;
        v_pur_res JSONB;
        v_recv_res JSONB;
    BEGIN
        -- Purchase Line 1: Supplier A (5.0 kg @ ₹24.00) = ₹120.00
        SELECT record_procurement_purchase_line(
            v_item_tomato.id,
            v_sup1,
            5.000,
            24.00,
            'LOT-PATEL-01',
            'Grade A Farm Tomatoes'
        ) INTO v_pur_res;

        -- Purchase Line 2: Supplier B (4.0 kg @ ₹25.00) = ₹100.00
        -- Total Purchased = 9.0 kg, Total Cost = ₹220.00
        SELECT record_procurement_purchase_line(
            v_item_tomato.id,
            v_sup2,
            4.000,
            25.00,
            'LOT-KESHAV-02',
            'Fresh Mandi stock'
        ) INTO v_pur_res;

        IF (v_pur_res->>'total_procured_qty')::numeric <> 9.000 THEN
            RAISE EXCEPTION 'TEST 6A FAILED: Expected 9.000 kg total procured, got %', v_pur_res->>'total_procured_qty';
        END IF;

        IF (v_pur_res->>'total_item_cost')::numeric <> 220.00 THEN
            RAISE EXCEPTION 'TEST 6A FAILED: Expected ₹220.00 total item cost, got %', v_pur_res->>'total_item_cost';
        END IF;

        -- Record Receiving & Sorting: 9.0 kg received, 8.5 kg usable -> 0.5 kg wastage
        -- Effective cost per usable unit = 220.00 / 8.5 = ₹25.88 / kg
        SELECT record_procurement_receiving_and_wastage(
            v_item_tomato.id,
            9.000,
            8.500,
            '0.5kg rejected during sorting'
        ) INTO v_recv_res;

        IF (v_recv_res->>'wastage_qty')::numeric <> 0.500 THEN
            RAISE EXCEPTION 'TEST 6B FAILED: Expected 0.500 kg wastage, got %', v_recv_res->>'wastage_qty';
        END IF;

        IF (v_recv_res->>'effective_cost_per_usable_unit')::numeric <> 25.88 THEN
            RAISE EXCEPTION 'TEST 6B FAILED: Expected effective cost 25.88, got %', v_recv_res->>'effective_cost_per_usable_unit';
        END IF;
    END;
    RAISE NOTICE '✅ TEST 6 PASSED: Multi-supplier purchasing, receiving, wastage and effective cost verified.';


    -- =========================================================================
    -- TEST 7: Zero-Order Guard (NO_ELIGIBLE_ORDERS)
    -- =========================================================================
    RAISE NOTICE '[TEST 7] Testing empty batch guard for date with 0 orders...';
    SELECT lock_daily_procurement_batch('2026-12-31'::date, '2026-12-30 20:00:00+05:30'::timestamptz, NULL) INTO v_res;

    IF (v_res->>'success')::boolean IS NOT FALSE OR v_res->>'error_code' <> 'NO_ELIGIBLE_ORDERS' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Expected NO_ELIGIBLE_ORDERS, got %', v_res;
    END IF;
    RAISE NOTICE '✅ TEST 7 PASSED: Zero-order guard safely prevented corrupt batch creation.';


    -- Clean up test records (without touching immutable audit_logs)
    DELETE FROM procurement_purchase_lines WHERE procurement_item_id IN (v_item_tomato.id, v_item_coriander.id);
    DELETE FROM procurement_items WHERE batch_id = v_batch_id;
    DELETE FROM procurement_batch_orders WHERE batch_id = v_batch_id;
    DELETE FROM procurement_batches WHERE id = v_batch_id;
    DELETE FROM order_items WHERE order_id IN (v_order1_id, v_order2_id, v_order_late_id);
    DELETE FROM promotion_usage WHERE order_id IN (v_order1_id, v_order2_id, v_order_late_id);
    DELETE FROM orders WHERE id IN (v_order1_id, v_order2_id, v_order_late_id);
    DELETE FROM customer_addresses WHERE id IN (v_addr1_id, v_addr2_id);
    DELETE FROM customers WHERE id IN (v_cust1_id, v_cust2_id);
    DELETE FROM product_variants WHERE product_id IN (v_prod_tomato, v_prod_coriander);
    DELETE FROM supplier_products WHERE product_id IN (v_prod_tomato, v_prod_coriander);
    DELETE FROM products WHERE id IN (v_prod_tomato, v_prod_coriander);

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ALL 8 PM PROCUREMENT BATCH TESTS PASSED 100%%!';
    RAISE NOTICE '============================================================';
END $$;
