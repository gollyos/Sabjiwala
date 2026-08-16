-- =============================================================================
-- SABJIWALA: ATOMIC ORDER CREATION & MY ORDERS MODULE
-- =============================================================================

BEGIN;

-- 1. Add idempotency_key to orders table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(100);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_idempotency 
ON orders(customer_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;


-- 2. Drop existing create_customer_order overloads to ensure clean upgrade
DROP FUNCTION IF EXISTS create_customer_order(UUID, payment_method_type, JSONB, TEXT, order_channel_type);
DROP FUNCTION IF EXISTS create_customer_order(UUID, payment_method_type, JSONB, TEXT, TEXT, order_channel_type);
DROP FUNCTION IF EXISTS create_customer_order(UUID, VARCHAR, JSONB, TEXT, VARCHAR, VARCHAR);


-- 3. Enhanced Atomic Order Creation Function
CREATE OR REPLACE FUNCTION create_customer_order(
    p_customer_address_id UUID,
    p_payment_method VARCHAR(30) DEFAULT 'cod',
    p_items JSONB DEFAULT '[]'::jsonb,
    p_special_instructions TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL,
    p_channel VARCHAR(30) DEFAULT 'web'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer RECORD;
    v_address RECORD;
    v_existing_order RECORD;
    v_promo RECORD;
    v_channel order_channel_type;
    v_payment_method payment_method_type;
    v_is_cod BOOLEAN := false;
    
    -- Financials & Settings
    v_min_order NUMERIC(10, 2) := 200.00;
    v_delivery_fee NUMERIC(10, 2) := 0.00;
    v_subtotal NUMERIC(10, 2) := 0.00;
    v_total_cost NUMERIC(10, 2) := 0.00;
    v_first_order_discount NUMERIC(10, 2) := 0.00;
    v_promo_discount NUMERIC(10, 2) := 0.00;
    v_cod_discount NUMERIC(10, 2) := 0.00;
    v_remaining_merchandise NUMERIC(10, 2) := 0.00;
    v_final_payable NUMERIC(10, 2) := 0.00;
    
    -- Item Loop Variables
    v_item JSONB;
    v_variant_id UUID;
    v_qty NUMERIC;
    v_expected_price NUMERIC;
    v_variant RECORD;
    v_line_total NUMERIC(10, 2);
    v_line_cost NUMERIC(10, 2);
    
    -- Order Record Variables
    v_order_id UUID;
    v_order_number VARCHAR(50);
    v_now_ist TIMESTAMPTZ := now();
    v_order_status order_status_type;
    v_payment_status payment_status_type;
    v_confirmed_at TIMESTAMPTZ;
    v_is_before_cutoff BOOLEAN;
    v_delivery_date DATE;
    v_slot_start TIME;
    v_slot_end TIME;
    v_already_used_promo BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_AUTHENTICATED: Authentication required to place orders.' USING ERRCODE = 'P0001';
    END IF;

    -- Normalize channel & payment method
    BEGIN
        v_channel := LOWER(TRIM(COALESCE(p_channel, 'web')))::order_channel_type;
    EXCEPTION WHEN OTHERS THEN
        v_channel := 'web'::order_channel_type;
    END;

    IF LOWER(TRIM(COALESCE(p_payment_method, 'cod'))) = 'cod' THEN
        v_payment_method := 'cod'::payment_method_type;
        v_is_cod := true;
    ELSIF LOWER(TRIM(p_payment_method)) IN ('online', 'online_upi') THEN
        v_payment_method := 'online_upi'::payment_method_type;
        v_is_cod := false;
    ELSIF LOWER(TRIM(p_payment_method)) = 'online_card' THEN
        v_payment_method := 'online_card'::payment_method_type;
        v_is_cod := false;
    ELSIF LOWER(TRIM(p_payment_method)) = 'online_netbanking' THEN
        v_payment_method := 'online_netbanking'::payment_method_type;
        v_is_cod := false;
    ELSE
        v_payment_method := 'cod'::payment_method_type;
        v_is_cod := true;
    END IF;

    -- Lock & Resolve Customer Record to prevent race conditions
    SELECT * INTO v_customer 
    FROM customers 
    WHERE auth_user_id = v_user_id AND is_active = true 
    FOR UPDATE;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: Customer profile does not exist.' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_customer.is_verified THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_VERIFIED: Mobile number must be verified before placing order.' USING ERRCODE = 'P0003';
    END IF;

    -- Idempotency Check: if same customer and idempotency_key provided, return existing order
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_order 
        FROM orders 
        WHERE customer_id = v_customer.id AND idempotency_key = TRIM(p_idempotency_key)
        LIMIT 1;

        IF v_existing_order.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_idempotent_replay', true,
                'order_id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'order_status', v_existing_order.order_status,
                'payment_status', v_existing_order.payment_status,
                'payment_method', v_existing_order.payment_method,
                'subtotal', v_existing_order.subtotal_amount,
                'first_order_discount', v_existing_order.first_order_discount,
                'cod_discount', v_existing_order.cod_discount,
                'delivery_charge', v_existing_order.delivery_charge,
                'final_payable_amount', v_existing_order.final_payable_amount,
                'delivery_date', v_existing_order.delivery_date,
                'delivery_slot', '10:00 AM – 01:00 PM',
                'is_before_cutoff', v_existing_order.is_before_cutoff,
                'placed_at', v_existing_order.placed_at
            );
        END IF;
    END IF;

    -- Verify Delivery Address belongs to Customer and is not deleted
    SELECT * INTO v_address 
    FROM customer_addresses 
    WHERE id = p_customer_address_id AND customer_id = v_customer.id AND is_deleted = false;

    IF v_address.id IS NULL THEN
        RAISE EXCEPTION 'ADDRESS_NOT_FOUND: Valid customer delivery address not found.' USING ERRCODE = 'P0004';
    END IF;

    -- Load minimum order setting
    SELECT COALESCE((value->>'amount')::numeric, 200.00) INTO v_min_order 
    FROM app_settings WHERE key = 'min_order_amount';

    SELECT COALESCE((value->>'amount')::numeric, 0.00) INTO v_delivery_fee 
    FROM app_settings WHERE key = 'delivery_fee';

    -- Validate Items Array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_CART: Cannot place order with an empty cart.' USING ERRCODE = 'P0005';
    END IF;

    -- First Pass: Recalculate and Validate all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_qty := (v_item->>'quantity')::numeric;
        v_expected_price := (v_item->>'expected_unit_price')::numeric;

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: Invalid product item quantity specified.' USING ERRCODE = 'P0006';
        END IF;

        SELECT 
            pv.id AS variant_id,
            pv.product_id,
            pv.unit_id,
            pv.variant_name_en,
            pv.variant_name_gu,
            pv.multiplier_to_base_unit,
            pv.selling_price,
            pv.current_estimated_cost,
            pv.is_active AS variant_active,
            p.name_en AS product_name_en,
            p.name_gu AS product_name_gu,
            p.is_in_stock AS product_in_stock,
            p.is_active AS product_active,
            u.code AS unit_code
        INTO v_variant
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        JOIN product_units u ON pv.unit_id = u.id
        WHERE pv.id = v_variant_id;

        IF v_variant.variant_id IS NULL OR NOT v_variant.variant_active OR NOT v_variant.product_active THEN
            RAISE EXCEPTION 'VARIANT_UNAVAILABLE: Product variant % is inactive or removed.', v_variant_id USING ERRCODE = 'P0007';
        END IF;

        IF NOT v_variant.product_in_stock THEN
            RAISE EXCEPTION 'PRODUCT_UNAVAILABLE: % (%) is currently out of stock.', v_variant.product_name_en, v_variant.product_name_gu USING ERRCODE = 'P0008';
        END IF;

        -- Detect if client had a stale price
        IF v_expected_price IS NOT NULL AND v_expected_price <> v_variant.selling_price THEN
            RAISE EXCEPTION 'PRICE_CHANGED: Price for % (%) updated from ₹% to ₹%. Please refresh your cart.', 
                v_variant.product_name_en, v_variant.variant_name_en, v_expected_price, v_variant.selling_price 
                USING ERRCODE = 'P0009';
        END IF;

        v_line_total := ROUND(v_variant.selling_price * v_qty, 2);
        v_line_cost := ROUND(COALESCE(v_variant.current_estimated_cost, 0.00) * v_qty, 2);

        v_subtotal := v_subtotal + v_line_total;
        v_total_cost := v_total_cost + v_line_cost;
    END LOOP;

    -- Validate Minimum Order on Merchandise Subtotal BEFORE discounts
    IF v_subtotal < v_min_order THEN
        RAISE EXCEPTION 'MINIMUM_ORDER_NOT_MET: Minimum order subtotal is ₹%. Current subtotal is ₹%.', v_min_order, v_subtotal USING ERRCODE = 'P0010';
    END IF;

    -- Check FIRST500 Promotion Eligibility
    IF v_customer.is_verified AND v_customer.verified_sequence IS NOT NULL AND v_customer.verified_sequence <= 500 THEN
        SELECT p.* INTO v_promo 
        FROM promotions p 
        WHERE p.promo_code = 'FIRST500' AND p.is_active = true 
        LIMIT 1;

        IF v_promo.id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM promotion_usage 
                WHERE promotion_id = v_promo.id 
                  AND customer_id = v_customer.id 
                  AND status IN ('reserved', 'consumed')
                FOR UPDATE
            ) INTO v_already_used_promo;

            IF NOT v_already_used_promo THEN
                v_first_order_discount := ROUND(v_subtotal * (v_promo.discount_value / 100.00), 2);
            END IF;
        END IF;
    END IF;

    -- Stacking: Calculate COD 2% discount on remaining merchandise
    v_remaining_merchandise := GREATEST(0.00, v_subtotal - v_first_order_discount);

    IF v_is_cod THEN
        v_cod_discount := ROUND(v_remaining_merchandise * 0.02, 2);
    ELSE
        v_cod_discount := 0.00;
    END IF;

    v_final_payable := GREATEST(0.00, v_subtotal - v_first_order_discount - v_cod_discount + v_delivery_fee);
    v_order_number := generate_order_number();

    -- Determine COD vs Online Status & Cutoff Calculation
    IF v_is_cod THEN
        v_order_status := 'confirmed'::order_status_type;
        v_payment_status := 'pending'::payment_status_type;
        v_confirmed_at := v_now_ist;
        v_is_before_cutoff := ((v_now_ist AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time);
        
        IF v_is_before_cutoff THEN
            v_delivery_date := (v_now_ist AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day';
        ELSE
            v_delivery_date := (v_now_ist AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '2 days';
        END IF;

        v_slot_start := '10:00:00'::time;
        v_slot_end := '13:00:00'::time;
    ELSE
        v_order_status := 'payment_pending'::order_status_type;
        v_payment_status := 'pending'::payment_status_type;
        v_confirmed_at := NULL;
        v_is_before_cutoff := NULL;
        v_delivery_date := NULL;
        v_slot_start := NULL;
        v_slot_end := NULL;
    END IF;

    -- Insert Master Order Record with Snapshots
    INSERT INTO orders (
        order_number,
        customer_id,
        delivery_address_id,
        channel,
        order_status,
        payment_method,
        payment_status,
        minimum_order_amount_snapshot,
        subtotal_amount,
        first_order_discount,
        promo_discount,
        cod_discount,
        delivery_charge,
        final_payable_amount,
        total_cost_amount,
        placed_at,
        confirmed_at,
        is_before_cutoff,
        delivery_date,
        delivery_slot_start,
        delivery_slot_end,
        customer_name_snapshot,
        customer_mobile_snapshot,
        customer_alternate_mobile_snapshot,
        delivery_flat_house_snapshot,
        delivery_society_street_snapshot,
        delivery_landmark_snapshot,
        delivery_area_snapshot,
        delivery_city_snapshot,
        delivery_district_snapshot,
        delivery_pincode_snapshot,
        delivery_latitude_snapshot,
        delivery_longitude_snapshot,
        customer_snapshot_json,
        special_instructions,
        idempotency_key
    ) VALUES (
        v_order_number,
        v_customer.id,
        v_address.id,
        v_channel,
        v_order_status,
        v_payment_method,
        v_payment_status,
        v_min_order,
        v_subtotal,
        v_first_order_discount,
        v_promo_discount,
        v_cod_discount,
        v_delivery_fee,
        v_final_payable,
        v_total_cost,
        v_now_ist,
        v_confirmed_at,
        v_is_before_cutoff,
        v_delivery_date,
        v_slot_start,
        v_slot_end,
        v_customer.full_name,
        v_customer.mobile,
        v_customer.alternate_mobile,
        v_address.flat_house_no,
        v_address.society_street_name,
        v_address.landmark,
        v_address.area_locality,
        v_address.city,
        v_address.district,
        v_address.pincode,
        v_address.latitude,
        v_address.longitude,
        to_jsonb(v_customer) || jsonb_build_object('address', to_jsonb(v_address)),
        p_special_instructions,
        TRIM(p_idempotency_key)
    ) RETURNING id INTO v_order_id;

    -- Second Pass: Insert Order Items with Snapshots
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_qty := (v_item->>'quantity')::numeric;

        SELECT 
            pv.id AS variant_id,
            pv.product_id,
            pv.unit_id,
            pv.variant_name_en,
            pv.variant_name_gu,
            pv.multiplier_to_base_unit,
            pv.selling_price,
            pv.current_estimated_cost,
            p.name_en AS product_name_en,
            p.name_gu AS product_name_gu,
            u.code AS unit_code
        INTO v_variant
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        JOIN product_units u ON pv.unit_id = u.id
        WHERE pv.id = v_variant_id;

        v_line_total := ROUND(v_variant.selling_price * v_qty, 2);
        v_line_cost := ROUND(COALESCE(v_variant.current_estimated_cost, 0.00) * v_qty, 2);

        INSERT INTO order_items (
            order_id,
            product_id,
            product_variant_id,
            unit_id,
            quantity,
            equivalent_base_qty,
            product_name_en_snapshot,
            product_name_gu_snapshot,
            variant_name_en_snapshot,
            variant_name_gu_snapshot,
            unit_code_snapshot,
            selling_price_snapshot,
            cost_price_snapshot,
            line_total,
            line_cost_total
        ) VALUES (
            v_order_id,
            v_variant.product_id,
            v_variant.variant_id,
            v_variant.unit_id,
            v_qty,
            ROUND(v_qty * v_variant.multiplier_to_base_unit, 3),
            v_variant.product_name_en,
            v_variant.product_name_gu,
            v_variant.variant_name_en,
            v_variant.variant_name_gu,
            v_variant.unit_code,
            v_variant.selling_price,
            COALESCE(v_variant.current_estimated_cost, 0.00),
            v_line_total,
            v_line_cost
        );
    END LOOP;

    -- Reserve FIRST500 Promotion Usage
    IF v_first_order_discount > 0 AND v_promo.id IS NOT NULL THEN
        INSERT INTO promotion_usage (
            promotion_id,
            customer_id,
            order_id,
            status,
            discount_amount_applied,
            used_at
        ) VALUES (
            v_promo.id,
            v_customer.id,
            v_order_id,
            'reserved'::promo_usage_status_type,
            v_first_order_discount,
            v_now_ist
        );
    END IF;

    -- Audit Log Entry
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        performed_by
    ) VALUES (
        'orders',
        v_order_id,
        'insert',
        jsonb_build_object(
            'order_number', v_order_number,
            'customer_id', v_customer.id,
            'payment_method', v_payment_method,
            'final_payable_amount', v_final_payable,
            'channel', v_channel
        ),
        v_user_id
    );

    -- Return Structured Response
    RETURN jsonb_build_object(
        'success', true,
        'is_idempotent_replay', false,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'order_status', v_order_status,
        'payment_status', v_payment_status,
        'payment_method', v_payment_method,
        'subtotal', v_subtotal,
        'first_order_discount', v_first_order_discount,
        'cod_discount', v_cod_discount,
        'delivery_charge', v_delivery_fee,
        'final_payable_amount', v_final_payable,
        'delivery_date', v_delivery_date,
        'delivery_slot', CASE WHEN v_is_cod THEN '10:00 AM – 01:00 PM' ELSE NULL END,
        'is_before_cutoff', v_is_before_cutoff,
        'placed_at', v_now_ist
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_customer_order(UUID, VARCHAR, JSONB, TEXT, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_customer_order(UUID, VARCHAR, JSONB, TEXT, VARCHAR, VARCHAR) TO authenticated;


-- 4. Customer Secure Orders Query RPCs (Zero Exposure of Cost Fields)
CREATE OR REPLACE FUNCTION get_my_orders()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer_id UUID;
    v_result JSONB;
BEGIN
    SELECT id INTO v_customer_id FROM customers WHERE auth_user_id = v_user_id AND is_active = true;
    
    IF v_customer_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'order_status', o.order_status,
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'subtotal_amount', o.subtotal_amount,
            'first_order_discount', o.first_order_discount,
            'cod_discount', o.cod_discount,
            'delivery_charge', o.delivery_charge,
            'final_payable_amount', o.final_payable_amount,
            'placed_at', o.placed_at,
            'confirmed_at', o.confirmed_at,
            'delivery_date', o.delivery_date,
            'delivery_slot_start', o.delivery_slot_start,
            'delivery_slot_end', o.delivery_slot_end,
            'customer_name_snapshot', o.customer_name_snapshot,
            'delivery_area_snapshot', o.delivery_area_snapshot,
            'item_count', (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id)
        ) ORDER BY o.placed_at DESC
    ), '[]'::jsonb)
    INTO v_result
    FROM orders o
    WHERE o.customer_id = v_customer_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_my_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_orders() TO authenticated;


CREATE OR REPLACE FUNCTION get_my_order_details(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer_id UUID;
    v_order RECORD;
    v_items JSONB;
BEGIN
    SELECT id INTO v_customer_id FROM customers WHERE auth_user_id = v_user_id AND is_active = true;
    
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer profile not found.';
    END IF;

    SELECT * INTO v_order 
    FROM orders 
    WHERE id = p_order_id AND customer_id = v_customer_id;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found or unauthorized.';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_variant_id', oi.product_variant_id,
            'quantity', oi.quantity,
            'product_name_en', oi.product_name_en_snapshot,
            'product_name_gu', oi.product_name_gu_snapshot,
            'variant_name_en', oi.variant_name_en_snapshot,
            'variant_name_gu', oi.variant_name_gu_snapshot,
            'unit_code', oi.unit_code_snapshot,
            'selling_price', oi.selling_price_snapshot,
            'line_total', oi.line_total
        )
    ), '[]'::jsonb)
    INTO v_items
    FROM order_items oi
    WHERE oi.order_id = v_order.id;

    RETURN jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'order_status', v_order.order_status,
        'payment_method', v_order.payment_method,
        'payment_status', v_order.payment_status,
        'subtotal_amount', v_order.subtotal_amount,
        'first_order_discount', v_order.first_order_discount,
        'cod_discount', v_order.cod_discount,
        'delivery_charge', v_order.delivery_charge,
        'final_payable_amount', v_order.final_payable_amount,
        'placed_at', v_order.placed_at,
        'confirmed_at', v_order.confirmed_at,
        'delivery_date', v_order.delivery_date,
        'delivery_slot_start', v_order.delivery_slot_start,
        'delivery_slot_end', v_order.delivery_slot_end,
        'customer_name', v_order.customer_name_snapshot,
        'customer_mobile', v_order.customer_mobile_snapshot,
        'delivery_address', jsonb_build_object(
            'flat_house', v_order.delivery_flat_house_snapshot,
            'society_street', v_order.delivery_society_street_snapshot,
            'landmark', v_order.delivery_landmark_snapshot,
            'area_locality', v_order.delivery_area_snapshot,
            'city', v_order.delivery_city_snapshot,
            'district', v_order.delivery_district_snapshot,
            'pincode', v_order.delivery_pincode_snapshot
        ),
        'special_instructions', v_order.special_instructions,
        'items', v_items
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_my_order_details(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_order_details(UUID) TO authenticated;

COMMIT;
