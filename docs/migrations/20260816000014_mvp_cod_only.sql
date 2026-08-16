-- =============================================================================
-- SABJIWALA MVP: COD-ONLY ORDER WORKFLOW & PRICING HARDENING
-- =============================================================================

BEGIN;

-- 1. Update/Ensure app_settings has cod_discount_pct set to 2%
INSERT INTO app_settings (key, value, description)
VALUES 
    ('cod_discount_pct', '{"is_active": true, "percentage": 2.0}'::jsonb, 'Cash on delivery discount percentage'),
    ('delivery_cutoff_time', '{"time": "20:00:00", "timezone": "Asia/Kolkata"}'::jsonb, 'Daily delivery order cutoff time')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;


-- 2. Enhanced COD-Only Quote Calculation Engine
CREATE OR REPLACE FUNCTION calculate_checkout_quote(
    p_items JSONB,
    p_payment_method VARCHAR(20) DEFAULT 'cod'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer RECORD;
    v_promo RECORD;
    
    -- App settings
    v_min_order_amount NUMERIC := 200.00;
    v_cod_discount_pct NUMERIC := 2.00;
    v_delivery_fee NUMERIC := 0.00;
    
    -- Consolidated items loop
    v_item JSONB;
    v_variant_id UUID;
    v_qty NUMERIC;
    v_variant RECORD;
    v_is_available BOOLEAN;
    v_unavail_reason TEXT;
    v_line_total NUMERIC;
    
    -- Aggregated Financials
    v_subtotal NUMERIC := 0.00;
    v_minimum_order_met BOOLEAN := false;
    v_remaining_to_minimum NUMERIC := 0.00;
    
    -- First 500 Promo
    v_first500_eligible BOOLEAN := false;
    v_first500_pct NUMERIC := 0.00;
    v_first500_discount NUMERIC := 0.00;
    v_first500_reason TEXT := 'Sign in with phone OTP to check launch discount eligibility';
    v_already_used BOOLEAN := false;
    
    -- COD Payment Discount
    v_remaining_merchandise NUMERIC := 0.00;
    v_payment_discount_amount NUMERIC := 0.00;
    
    -- Final Payable
    v_final_payable NUMERIC := 0.00;
    
    -- Output arrays
    v_items_result JSONB := '[]'::jsonb;
    v_has_unavailable BOOLEAN := false;
BEGIN
    -- Load settings from app_settings
    SELECT COALESCE((value->>'amount')::numeric, 200.00) INTO v_min_order_amount
    FROM app_settings WHERE key = 'min_order_amount';

    SELECT COALESCE((value->>'percentage')::numeric, 2.00) INTO v_cod_discount_pct
    FROM app_settings WHERE key = 'cod_discount_pct' AND (value->>'is_active')::boolean = true;

    SELECT COALESCE((value->>'amount')::numeric, 0.00) INTO v_delivery_fee
    FROM app_settings WHERE key = 'delivery_fee';

    -- Process each cart item
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_variant_id := (v_item->>'variant_id')::uuid;
            v_qty := COALESCE((v_item->>'quantity')::numeric, 0);

            IF v_variant_id IS NULL OR v_qty <= 0 THEN
                CONTINUE;
            END IF;

            -- Query active variant and parent product
            SELECT 
                pv.id AS variant_id,
                pv.product_id,
                pv.variant_name_en,
                pv.variant_name_gu,
                pv.selling_price,
                pv.is_active AS variant_active,
                pv.min_order_qty,
                pv.max_order_qty,
                p.name_en AS product_name_en,
                p.name_gu AS product_name_gu,
                p.image_url,
                p.is_in_stock AS product_in_stock,
                p.is_active AS product_active
            INTO v_variant
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE pv.id = v_variant_id;

            IF v_variant.variant_id IS NULL THEN
                v_is_available := false;
                v_unavail_reason := 'Item not found in catalog';
                v_has_unavailable := true;
                v_line_total := 0.00;
            ELSIF NOT v_variant.product_active OR NOT v_variant.variant_active THEN
                v_is_available := false;
                v_unavail_reason := 'Product or pack variant has been disabled';
                v_has_unavailable := true;
                v_line_total := 0.00;
            ELSIF NOT v_variant.product_in_stock THEN
                v_is_available := false;
                v_unavail_reason := 'Currently out of stock (સ્ટોક ખલાસ)';
                v_has_unavailable := true;
                v_line_total := 0.00;
            ELSE
                v_is_available := true;
                v_unavail_reason := NULL;
                v_line_total := ROUND(v_variant.selling_price * v_qty, 2);
                v_subtotal := v_subtotal + v_line_total;
            END IF;

            v_items_result := v_items_result || jsonb_build_object(
                'variant_id', v_variant_id,
                'product_id', v_variant.product_id,
                'product_name_en', COALESCE(v_variant.product_name_en, 'Unknown Product'),
                'product_name_gu', COALESCE(v_variant.product_name_gu, 'અજાણ્યું ઉત્પાદન'),
                'variant_name_en', COALESCE(v_variant.variant_name_en, ''),
                'variant_name_gu', COALESCE(v_variant.variant_name_gu, ''),
                'image_url', v_variant.image_url,
                'quantity', v_qty,
                'unit_price', COALESCE(v_variant.selling_price, 0.00),
                'line_total', v_line_total,
                'is_available', v_is_available,
                'unavailability_reason', v_unavail_reason
            );
        END LOOP;
    END IF;

    -- Minimum order check on merchandise subtotal before discounts
    v_minimum_order_met := (v_subtotal >= v_min_order_amount);
    v_remaining_to_minimum := GREATEST(0.00, ROUND(v_min_order_amount - v_subtotal, 2));

    -- Check FIRST500 Promotion Eligibility
    IF v_user_id IS NOT NULL THEN
        SELECT * INTO v_customer 
        FROM customers 
        WHERE auth_user_id = v_user_id AND is_active = true;

        IF v_customer.id IS NOT NULL THEN
            IF v_customer.is_verified AND v_customer.verified_sequence IS NOT NULL THEN
                SELECT * INTO v_promo 
                FROM promotions 
                WHERE promo_code = 'FIRST500' AND is_active = true 
                LIMIT 1;

                IF v_promo.id IS NOT NULL THEN
                    IF v_customer.verified_sequence <= v_promo.max_verified_customer_seq THEN
                        SELECT EXISTS (
                            SELECT 1 FROM promotion_usage 
                            WHERE customer_id = v_customer.id 
                              AND promotion_id = v_promo.id 
                              AND status IN ('reserved', 'consumed')
                        ) INTO v_already_used;

                        IF v_already_used THEN
                            v_first500_eligible := false;
                            v_first500_reason := 'Launch discount already applied to a previous order';
                        ELSE
                            v_first500_eligible := true;
                            v_first500_pct := v_promo.discount_value; -- 10.00%
                            v_first500_discount := ROUND(v_subtotal * (v_first500_pct / 100.0), 2);
                            v_first500_reason := format('10%% First Order Launch Discount (Customer #%s)', v_customer.verified_sequence);
                        END IF;
                    ELSE
                        v_first500_eligible := false;
                        v_first500_reason := format('Verified customer sequence (#%s) exceeds launch offer limit (500)', v_customer.verified_sequence);
                    END IF;
                ELSE
                    v_first500_eligible := false;
                    v_first500_reason := 'Launch promotion is currently inactive';
                END IF;
            ELSE
                v_first500_eligible := false;
                v_first500_reason := 'Complete phone verification to unlock 10% first order discount';
            END IF;
        ELSE
            v_first500_eligible := false;
            v_first500_reason := 'Complete customer profile setup to unlock launch offer';
        END IF;
    ELSE
        v_first500_eligible := false;
        v_first500_reason := 'Sign in with phone OTP to check 10% first order discount';
    END IF;

    -- COD Discount (2%) calculated on remaining merchandise
    v_remaining_merchandise := GREATEST(0.00, v_subtotal - v_first500_discount);
    v_payment_discount_amount := ROUND(v_remaining_merchandise * (v_cod_discount_pct / 100.0), 2);

    -- Final Payable Amount
    v_final_payable := GREATEST(0.00, v_subtotal - v_first500_discount - v_payment_discount_amount + v_delivery_fee);

    RETURN jsonb_build_object(
        'items', v_items_result,
        'has_unavailable_items', v_has_unavailable,
        'subtotal', v_subtotal,
        'minimum_order_amount', v_min_order_amount,
        'minimum_order_met', v_minimum_order_met,
        'remaining_amount_to_minimum', v_remaining_to_minimum,
        'promotion', jsonb_build_object(
            'code', 'FIRST500',
            'eligible', v_first500_eligible,
            'percentage', v_first500_pct,
            'discount_amount', v_first500_discount,
            'reason', v_first500_reason
        ),
        'payment', jsonb_build_object(
            'method', 'cod',
            'discount_percentage', v_cod_discount_pct,
            'discount_amount', v_payment_discount_amount,
            'label', 'Cash on Delivery (2% Discount Applied)'
        ),
        'delivery', jsonb_build_object(
            'charge', v_delivery_fee,
            'is_free', (v_delivery_fee = 0.00)
        ),
        'final_payable', v_final_payable,
        'quote_timestamp', now()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION calculate_checkout_quote(JSONB, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_checkout_quote(JSONB, VARCHAR) TO anon, authenticated;


-- 3. Enhanced COD-Only Atomic Order Creation Function
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
    
    -- Financials & Settings
    v_min_order NUMERIC(10, 2) := 200.00;
    v_cod_discount_pct NUMERIC(5, 2) := 2.00;
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
    v_confirmed_at TIMESTAMPTZ := now();
    v_is_before_cutoff BOOLEAN;
    v_delivery_date DATE;
    v_slot_start TIME := '10:00:00'::time;
    v_slot_end TIME := '13:00:00'::time;
    v_already_used_promo BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_AUTHENTICATED: Authentication required to place orders.' USING ERRCODE = 'P0001';
    END IF;

    -- Normalize channel
    BEGIN
        v_channel := LOWER(TRIM(COALESCE(p_channel, 'web')))::order_channel_type;
    EXCEPTION WHEN OTHERS THEN
        v_channel := 'web'::order_channel_type;
    END;

    -- Lock & Resolve Customer Record
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
                'placed_at', v_existing_order.placed_at,
                'confirmed_at', v_existing_order.confirmed_at
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

    -- Load minimum order and COD discount setting
    SELECT COALESCE((value->>'amount')::numeric, 200.00) INTO v_min_order 
    FROM app_settings WHERE key = 'min_order_amount';

    SELECT COALESCE((value->>'percentage')::numeric, 2.00) INTO v_cod_discount_pct 
    FROM app_settings WHERE key = 'cod_discount_pct';

    SELECT COALESCE((value->>'amount')::numeric, 0.00) INTO v_delivery_fee 
    FROM app_settings WHERE key = 'delivery_fee';

    -- Validate Items Array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_CART: Cannot place order with an empty cart.' USING ERRCODE = 'P0005';
    END IF;

    -- Validate and calculate all item lines
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_qty := (v_item->>'quantity')::numeric;
        v_expected_price := (v_item->>'expected_unit_price')::numeric;

        IF v_variant_id IS NULL OR v_qty <= 0 THEN
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

    -- Calculate COD discount (from app_settings, 2%) on remaining merchandise
    v_remaining_merchandise := GREATEST(0.00, v_subtotal - v_first_order_discount);
    v_cod_discount := ROUND(v_remaining_merchandise * (v_cod_discount_pct / 100.00), 2);

    v_final_payable := GREATEST(0.00, v_subtotal - v_first_order_discount - v_cod_discount + v_delivery_fee);
    v_order_number := generate_order_number();

    -- MVP COD Cutoff Calculation (Evaluated in Asia/Kolkata timezone against 20:00:00)
    v_is_before_cutoff := ((v_now_ist AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time);
    
    IF v_is_before_cutoff THEN
        v_delivery_date := (v_now_ist AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day';
    ELSE
        v_delivery_date := (v_now_ist AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '2 days';
    END IF;

    -- Insert Master COD Order Record with Snapshots
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
        'confirmed'::order_status_type,
        'cod'::payment_method_type,
        'pending'::payment_status_type,
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

    -- Insert Order Items with Snapshots
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

    -- Audit Log Entry (using action = 'INSERT')
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        v_order_id::text,
        'INSERT',
        jsonb_build_object(
            'order_number', v_order_number,
            'customer_id', v_customer.id,
            'payment_method', 'cod',
            'final_payable_amount', v_final_payable,
            'order_status', 'confirmed',
            'channel', v_channel
        ),
        v_user_id,
        'authenticated'
    );

    -- Return Structured Response
    RETURN jsonb_build_object(
        'success', true,
        'is_idempotent_replay', false,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'order_status', 'confirmed',
        'payment_status', 'pending',
        'payment_method', 'cod',
        'subtotal', v_subtotal,
        'first_order_discount', v_first_order_discount,
        'cod_discount', v_cod_discount,
        'delivery_charge', v_delivery_fee,
        'final_payable_amount', v_final_payable,
        'delivery_date', v_delivery_date,
        'delivery_slot', '10:00 AM – 01:00 PM',
        'is_before_cutoff', v_is_before_cutoff,
        'placed_at', v_now_ist,
        'confirmed_at', v_confirmed_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_customer_order(UUID, VARCHAR, JSONB, TEXT, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_customer_order(UUID, VARCHAR, JSONB, TEXT, VARCHAR, VARCHAR) TO authenticated;

COMMIT;
