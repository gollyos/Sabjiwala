-- =============================================================================
-- SABJIWALA TRIAL SEED DATA (ADMIN, GODOWN, DRIVER, CUSTOMER, ORDERS & FRUITS)
-- Migration: 20260819000003_complete_trial_seed_data.sql
-- =============================================================================

DO $$
DECLARE
    v_admin_id UUID := '11111111-1111-4111-a111-111111111111'::UUID;
    v_packing_id UUID := '22222222-2222-4222-a222-222222222222'::UUID;
    v_driver_id UUID := '33333333-3333-4333-a333-333333333333'::UUID;
    v_customer_user_id UUID := '44444444-4444-4444-a444-444444444444'::UUID;
    v_customer_id UUID;
    v_address_id UUID;
    
    v_veg_cat_id UUID;
    v_fruit_cat_id UUID;
    v_kg_unit_id UUID;
    v_dozen_unit_id UUID;
    v_pc_unit_id UUID;
    
    v_tomato_id UUID;
    v_apple_id UUID;
    v_banana_id UUID;
    
    v_tomato_var_1kg UUID;
    v_apple_var_1kg UUID;
    v_banana_var_dozen UUID;

    v_order_id UUID;
    v_batch_id UUID;
    v_delivery_id UUID;
    v_bag_id UUID;
    v_order_num VARCHAR(50);
BEGIN

    -- 1. Ensure Units Exist
    SELECT id INTO v_kg_unit_id FROM product_units WHERE code = 'kg' LIMIT 1;
    IF v_kg_unit_id IS NULL THEN
        INSERT INTO product_units (id, code, name_en, name_gu, base_multiplier)
        VALUES (gen_random_uuid(), 'kg', 'Kilogram', 'કિલોગ્રામ', 1.000)
        RETURNING id INTO v_kg_unit_id;
    END IF;

    SELECT id INTO v_dozen_unit_id FROM product_units WHERE code = 'dozen' LIMIT 1;
    IF v_dozen_unit_id IS NULL THEN
        INSERT INTO product_units (id, code, name_en, name_gu, base_multiplier)
        VALUES (gen_random_uuid(), 'dozen', 'Dozen (12 Pcs)', 'ડઝન (૧૨ નંગ)', 1.000)
        RETURNING id INTO v_dozen_unit_id;
    END IF;

    SELECT id INTO v_pc_unit_id FROM product_units WHERE code = 'pc' LIMIT 1;
    IF v_pc_unit_id IS NULL THEN
        INSERT INTO product_units (id, code, name_en, name_gu, base_multiplier)
        VALUES (gen_random_uuid(), 'pc', 'Piece', 'નંગ', 1.000)
        RETURNING id INTO v_pc_unit_id;
    END IF;

    -- 2. Ensure Categories Exist
    SELECT id INTO v_veg_cat_id FROM categories WHERE slug = 'daily-vegetables' LIMIT 1;
    IF v_veg_cat_id IS NULL THEN
        INSERT INTO categories (id, slug, name_en, name_gu, display_order, is_active)
        VALUES (gen_random_uuid(), 'daily-vegetables', 'Daily Vegetables', 'રોજિંદી શાકભાજી', 1, true)
        RETURNING id INTO v_veg_cat_id;
    END IF;

    SELECT id INTO v_fruit_cat_id FROM categories WHERE slug = 'fresh-fruits' LIMIT 1;
    IF v_fruit_cat_id IS NULL THEN
        INSERT INTO categories (id, slug, name_en, name_gu, display_order, is_active)
        VALUES (gen_random_uuid(), 'fresh-fruits', 'Fresh Fruits', 'તાજા ફળો', 2, true)
        RETURNING id INTO v_fruit_cat_id;
    END IF;

    -- 3. Upsert Staff User Profiles & Roles
    -- A) Admin / Owner
    INSERT INTO user_profiles (id, full_name, mobile, is_active)
    VALUES (v_admin_id, 'Gunjan Admin (Owner)', '+919876543210', true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, mobile = EXCLUDED.mobile, is_active = true;

    INSERT INTO user_roles (user_id, role)
    VALUES (v_admin_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- B) Godown / Packing Staff
    INSERT INTO user_profiles (id, full_name, mobile, is_active)
    VALUES (v_packing_id, 'Ramesh Godown (Packing Staff)', '+919876543211', true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, mobile = EXCLUDED.mobile, is_active = true;

    INSERT INTO user_roles (user_id, role)
    VALUES (v_packing_id, 'packing')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- C) Delivery Driver
    INSERT INTO user_profiles (id, full_name, mobile, is_active)
    VALUES (v_driver_id, 'Suresh Driver (Halol Route)', '+919876543212', true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, mobile = EXCLUDED.mobile, is_active = true;

    INSERT INTO user_roles (user_id, role)
    VALUES (v_driver_id, 'delivery')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 4. Upsert Test Customer & Address
    INSERT INTO user_profiles (id, full_name, mobile, is_active)
    VALUES (v_customer_user_id, 'Priya Patel (Halol Customer)', '+919876543213', true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, mobile = EXCLUDED.mobile, is_active = true;

    SELECT id INTO v_customer_id FROM customers WHERE user_id = v_customer_user_id LIMIT 1;
    IF v_customer_id IS NULL THEN
        INSERT INTO customers (id, user_id, full_name, mobile, is_onboarded, total_orders_count)
        VALUES (gen_random_uuid(), v_customer_user_id, 'Priya Patel', '+919876543213', true, 1)
        RETURNING id INTO v_customer_id;
    END IF;

    SELECT id INTO v_address_id FROM customer_addresses WHERE customer_id = v_customer_id LIMIT 1;
    IF v_address_id IS NULL THEN
        INSERT INTO customer_addresses (
            id, customer_id, address_label, flat_house_building, society_street_area,
            landmark, area, city, pincode, is_default
        )
        VALUES (
            gen_random_uuid(), v_customer_id, 'Home', 'Flat 402, Radhe Shyam Residency',
            'Near Baska Toll & GIDC Road', 'Opposite Gayatri Mandir', 'Baska / Halol Road',
            'Halol', '389350', true
        )
        RETURNING id INTO v_address_id;
    END IF;

    -- 5. Seed Core Products & Variants
    -- A) Tomato (ટામેટાં)
    SELECT id INTO v_tomato_id FROM products WHERE slug = 'desi-tomato' LIMIT 1;
    IF v_tomato_id IS NULL THEN
        INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, image_url, is_in_stock, is_active, display_order)
        VALUES (gen_random_uuid(), v_veg_cat_id, v_kg_unit_id, 'desi-tomato', 'Desi Fresh Tomato', 'દેશી લાલ ટામેટાં', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80', true, true, 1)
        RETURNING id INTO v_tomato_id;

        INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base, selling_price, is_default, is_active)
        VALUES (gen_random_uuid(), v_tomato_id, v_kg_unit_id, 'TOM-1KG', '1 Kilogram (૧ કિલો)', '૧ કિલોગ્રામ', 1.000, 38.00, true, true)
        RETURNING id INTO v_tomato_var_1kg;
    ELSE
        SELECT id INTO v_tomato_var_1kg FROM product_variants WHERE product_id = v_tomato_id LIMIT 1;
    END IF;

    -- B) Apple (સફરજન)
    SELECT id INTO v_apple_id FROM products WHERE slug = 'shimla-royal-apple' LIMIT 1;
    IF v_apple_id IS NULL THEN
        INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, image_url, is_in_stock, is_active, display_order)
        VALUES (gen_random_uuid(), v_fruit_cat_id, v_kg_unit_id, 'shimla-royal-apple', 'Shimla Royal Apple', 'શિમલા લાલ સફરજન', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80', true, true, 2)
        RETURNING id INTO v_apple_id;

        INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base, selling_price, is_default, is_active)
        VALUES (gen_random_uuid(), v_apple_id, v_kg_unit_id, 'APP-1KG', '1 Kilogram (૧ કિલો)', '૧ કિલોગ્રામ', 1.000, 140.00, true, true)
        RETURNING id INTO v_apple_var_1kg;
    ELSE
        SELECT id INTO v_apple_var_1kg FROM product_variants WHERE product_id = v_apple_id LIMIT 1;
    END IF;

    -- C) Banana (કેળાં)
    SELECT id INTO v_banana_id FROM products WHERE slug = 'robusta-banana' LIMIT 1;
    IF v_banana_id IS NULL THEN
        INSERT INTO products (id, category_id, base_unit_id, slug, name_en, name_gu, image_url, is_in_stock, is_active, display_order)
        VALUES (gen_random_uuid(), v_fruit_cat_id, v_dozen_unit_id, 'robusta-banana', 'Robusta Sweet Banana', 'મીઠાં પાકાં કેળાં', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=80', true, true, 3)
        RETURNING id INTO v_banana_id;

        INSERT INTO product_variants (id, product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base, selling_price, is_default, is_active)
        VALUES (gen_random_uuid(), v_banana_id, v_dozen_unit_id, 'BAN-1DOZ', '1 Dozen (૧૨ નંગ)', '૧ ડઝન (૧૨ નંગ)', 1.000, 48.00, true, true)
        RETURNING id INTO v_banana_var_dozen;
    ELSE
        SELECT id INTO v_banana_var_dozen FROM product_variants WHERE product_id = v_banana_id LIMIT 1;
    END IF;

    -- 6. Seed A Complete Test Order (For Packing & Delivery Trial)
    v_order_num := 'SBJ-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-001';
    SELECT id INTO v_order_id FROM orders WHERE order_number = v_order_num LIMIT 1;

    IF v_order_id IS NULL THEN
        INSERT INTO orders (
            id, order_number, customer_id, delivery_date, delivery_slot, order_status,
            payment_type, payment_status, subtotal_amount, first_order_discount, final_payable_amount,
            delivery_flat_house_snapshot, delivery_society_street_snapshot, delivery_landmark_snapshot,
            delivery_area_snapshot, delivery_city_snapshot, delivery_pincode_snapshot,
            customer_name_snapshot, customer_mobile_snapshot
        )
        VALUES (
            gen_random_uuid(), v_order_num, v_customer_id, CURRENT_DATE, 'morning_06_09', 'packed',
            'cod', 'pending', 226.00, 22.60, 203.40,
            'Flat 402, Radhe Shyam Residency', 'Near Baska Toll & GIDC Road', 'Opposite Gayatri Mandir',
            'Baska / Halol Road', 'Halol', '389350',
            'Priya Patel', '+919876543213'
        )
        RETURNING id INTO v_order_id;

        -- Order Items Snapshots
        IF v_tomato_var_1kg IS NOT NULL THEN
            INSERT INTO order_items (
                order_id, product_id, product_variant_id, unit_id, quantity, equivalent_base_qty,
                product_name_en_snapshot, product_name_gu_snapshot, variant_name_en_snapshot, variant_name_gu_snapshot,
                unit_code_snapshot, selling_price_snapshot, cost_price_snapshot, line_total, packed_quantity
            )
            VALUES (
                v_order_id, v_tomato_id, v_tomato_var_1kg, v_kg_unit_id, 1.0, 1.0,
                'Desi Fresh Tomato', 'દેશી લાલ ટામેટાં', '1 Kilogram', '૧ કિલોગ્રામ',
                'kg', 38.00, 28.00, 38.00, 1.0
            );
        END IF;

        IF v_apple_var_1kg IS NOT NULL THEN
            INSERT INTO order_items (
                order_id, product_id, product_variant_id, unit_id, quantity, equivalent_base_qty,
                product_name_en_snapshot, product_name_gu_snapshot, variant_name_en_snapshot, variant_name_gu_snapshot,
                unit_code_snapshot, selling_price_snapshot, cost_price_snapshot, line_total, packed_quantity
            )
            VALUES (
                v_order_id, v_apple_id, v_apple_var_1kg, v_kg_unit_id, 1.0, 1.0,
                'Shimla Royal Apple', 'શિમલા લાલ સફરજન', '1 Kilogram', '૧ કિલોગ્રામ',
                'kg', 140.00, 105.00, 140.00, 1.0
            );
        END IF;

        IF v_banana_var_dozen IS NOT NULL THEN
            INSERT INTO order_items (
                order_id, product_id, product_variant_id, unit_id, quantity, equivalent_base_qty,
                product_name_en_snapshot, product_name_gu_snapshot, variant_name_en_snapshot, variant_name_gu_snapshot,
                unit_code_snapshot, selling_price_snapshot, cost_price_snapshot, line_total, packed_quantity
            )
            VALUES (
                v_order_id, v_banana_id, v_banana_var_dozen, v_dozen_unit_id, 1.0, 1.0,
                'Robusta Sweet Banana', 'મીઠાં પાકાં કેળાં', '1 Dozen', '૧ ડઝન',
                'dozen', 48.00, 35.00, 48.00, 1.0
            );
        END IF;

        -- Order Bag
        INSERT INTO order_bags (
            id, order_id, bag_barcode, qr_token, bag_sequence, total_bags_in_order, is_packed, is_verified, packed_at
        )
        VALUES (
            gen_random_uuid(), v_order_id, 'BAG-HL-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-001',
            'BAGTOKEN' || floor(random()*899999 + 100000)::text, 1, 1, true, true, now()
        )
        RETURNING id INTO v_bag_id;

        -- Delivery Batch for Driver Trial
        SELECT id INTO v_batch_id FROM delivery_batches 
        WHERE delivery_date = CURRENT_DATE AND driver_user_id = v_driver_id LIMIT 1;

        IF v_batch_id IS NULL THEN
            INSERT INTO delivery_batches (
                id, batch_name, delivery_date, delivery_slot, driver_user_id, status, total_deliveries_count
            )
            VALUES (
                gen_random_uuid(), 'Halol Town & Baska Morning Route', CURRENT_DATE, 'morning_06_09',
                v_driver_id, 'assigned', 1
            )
            RETURNING id INTO v_batch_id;
        END IF;

        -- Delivery Stop
        INSERT INTO deliveries (
            id, batch_id, order_id, delivery_sequence, delivery_status,
            cod_amount_expected, payment_collection_method
        )
        VALUES (
            gen_random_uuid(), v_batch_id, v_order_id, 1, 'out_for_delivery',
            203.40, 'cash'
        )
        RETURNING id INTO v_delivery_id;

    END IF;

END $$;
