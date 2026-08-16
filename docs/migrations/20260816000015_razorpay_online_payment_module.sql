-- =============================================================================
-- SABJIWALA: PRODUCTION-GRADE RAZORPAY ONLINE PAYMENT MODULE
-- =============================================================================

BEGIN;

-- 1. Table Alterations: Add reconciliation & gateway tracking columns to payments
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS gateway_captured_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_transaction_id ON payments(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status_placed_at ON orders(order_status, placed_at);

-- 2. Ensure App Settings for Online Payment & Expiry are seeded
INSERT INTO app_settings (key, value, description)
VALUES 
    ('online_payment_config', '{"enabled": true, "provider": "razorpay"}'::jsonb, 'Online payment gateway configuration and feature toggle'),
    ('online_payment_expiry_minutes', '{"minutes": 15}'::jsonb, 'Automatic expiry timeout for payment_pending online orders'),
    ('online_discount_pct', '{"is_active": true, "percentage": 0.0}'::jsonb, 'Online payment discount percentage (0%)'),
    ('cod_discount_pct', '{"is_active": true, "percentage": 2.0}'::jsonb, 'Cash on Delivery discount percentage (2%)')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;


-- 3. Dual-Mode Server Pricing Engine (COD 2% vs Online 0%)
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
    v_online_discount_pct NUMERIC := 0.00;
    v_delivery_fee NUMERIC := 0.00;
    v_online_enabled BOOLEAN := true;
    v_is_cod BOOLEAN;
    v_payment_discount_pct NUMERIC := 0.00;
    
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
    
    -- Payment Method Discount
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

    SELECT COALESCE((value->>'percentage')::numeric, 0.00) INTO v_online_discount_pct
    FROM app_settings WHERE key = 'online_discount_pct' AND (value->>'is_active')::boolean = true;

    SELECT COALESCE((value->>'enabled')::boolean, true) INTO v_online_enabled
    FROM app_settings WHERE key = 'online_payment_config';

    SELECT COALESCE((value->>'amount')::numeric, 0.00) INTO v_delivery_fee
    FROM app_settings WHERE key = 'delivery_fee';

    -- Determine Payment Method
    IF LOWER(TRIM(COALESCE(p_payment_method, 'cod'))) IN ('cod', 'cash') THEN
        v_is_cod := true;
        v_payment_discount_pct := v_cod_discount_pct;
    ELSE
        v_is_cod := false;
        v_payment_discount_pct := v_online_discount_pct;
    END IF;

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

    -- Payment Method Discount calculated on remaining merchandise
    v_remaining_merchandise := GREATEST(0.00, v_subtotal - v_first500_discount);
    v_payment_discount_amount := ROUND(v_remaining_merchandise * (v_payment_discount_pct / 100.0), 2);

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
            'method', CASE WHEN v_is_cod THEN 'cod' ELSE 'online' END,
            'discount_percentage', v_payment_discount_pct,
            'discount_amount', v_payment_discount_amount,
            'label', CASE WHEN v_is_cod THEN 'Cash on Delivery (2% Discount Applied)' ELSE 'Online Payment (UPI, Cards, NetBanking)' END,
            'online_enabled', v_online_enabled
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


-- 4. Atomic Customer Order Creation Function (Supports both COD and Online)
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
    v_is_cod BOOLEAN;
    v_payment_method payment_method_type;
    v_order_status order_status_type;
    v_payment_status payment_status_type;
    
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

    -- Normalize channel
    BEGIN
        v_channel := LOWER(TRIM(COALESCE(p_channel, 'web')))::order_channel_type;
    EXCEPTION WHEN OTHERS THEN
        v_channel := 'web'::order_channel_type;
    END;

    -- Determine Payment Method & Type
    IF LOWER(TRIM(COALESCE(p_payment_method, 'cod'))) IN ('cod', 'cash') THEN
        v_is_cod := true;
        v_payment_method := 'cod'::payment_method_type;
    ELSE
        v_is_cod := false;
        v_payment_method := 'online_card'::payment_method_type; -- Default online category enum
    END IF;

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

    -- Calculate payment method discount
    v_remaining_merchandise := GREATEST(0.00, v_subtotal - v_first_order_discount);

    IF v_is_cod THEN
        v_cod_discount := ROUND(v_remaining_merchandise * (v_cod_discount_pct / 100.00), 2);
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
        -- Online Payment: Created as payment_pending, confirmed only upon verified capture
        v_cod_discount := 0.00;
        v_order_status := 'payment_pending'::order_status_type;
        v_payment_status := 'pending'::payment_status_type;
        v_confirmed_at := NULL;
        v_is_before_cutoff := NULL;
        v_delivery_date := NULL;
        v_slot_start := NULL;
        v_slot_end := NULL;
    END IF;

    v_final_payable := GREATEST(0.00, v_subtotal - v_first_order_discount - v_cod_discount + v_delivery_fee);
    v_order_number := generate_order_number();

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
            'payment_method', CASE WHEN v_is_cod THEN 'cod' ELSE 'online' END,
            'final_payable_amount', v_final_payable,
            'order_status', v_order_status,
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
        'order_status', v_order_status,
        'payment_status', v_payment_status,
        'payment_method', CASE WHEN v_is_cod THEN 'cod' ELSE 'online' END,
        'subtotal', v_subtotal,
        'first_order_discount', v_first_order_discount,
        'cod_discount', v_cod_discount,
        'delivery_charge', v_delivery_fee,
        'final_payable_amount', v_final_payable,
        'delivery_date', v_delivery_date,
        'delivery_slot', CASE WHEN v_delivery_date IS NOT NULL THEN '10:00 AM – 01:00 PM' ELSE NULL END,
        'is_before_cutoff', v_is_before_cutoff,
        'placed_at', v_now_ist,
        'confirmed_at', v_confirmed_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_customer_order(UUID, VARCHAR, JSONB, TEXT, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_customer_order(UUID, VARCHAR, JSONB, TEXT, VARCHAR, VARCHAR) TO authenticated;


-- 5. Atomic Online Payment Capture Confirmation Function
CREATE OR REPLACE FUNCTION confirm_online_payment_capture(
    p_order_id UUID,
    p_razorpay_order_id VARCHAR(100),
    p_razorpay_payment_id VARCHAR(100),
    p_payment_amount NUMERIC(10, 2),
    p_gateway_event_id VARCHAR(100) DEFAULT NULL,
    p_gateway_event_created_at TIMESTAMPTZ DEFAULT now(),
    p_webhook_event_id UUID DEFAULT NULL,
    p_gateway_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_payment_id UUID;
    v_is_before_cutoff BOOLEAN;
    v_delivery_date DATE;
    v_slot_start TIME := '10:00:00'::time;
    v_slot_end TIME := '13:00:00'::time;
    v_captured_at TIMESTAMPTZ;
    v_method_str VARCHAR(50);
    v_payment_method payment_method_type;
    v_customer_auth_id UUID;
BEGIN
    IF p_order_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ORDER_ID: Order ID cannot be null.' USING ERRCODE = 'P0011';
    END IF;

    -- Lock internal order row FOR UPDATE to ensure monotonicity & concurrency control
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order % does not exist.', p_order_id USING ERRCODE = 'P0012';
    END IF;

    -- Lookup customer auth_user_id for audit logging
    SELECT auth_user_id INTO v_customer_auth_id 
    FROM customers 
    WHERE id = v_order.customer_id;

    -- If order is already confirmed, this is an idempotent duplicate callback / webhook
    IF v_order.order_status = 'confirmed' AND v_order.payment_status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate_confirmation', true,
            'order_id', v_order.id,
            'order_number', v_order.order_number,
            'order_status', v_order.order_status,
            'payment_status', v_order.payment_status,
            'confirmed_at', v_order.confirmed_at,
            'delivery_date', v_order.delivery_date,
            'delivery_slot', '10:00 AM – 01:00 PM',
            'final_payable_amount', v_order.final_payable_amount
        );
    END IF;

    -- If order was cancelled, reject confirmation and log reconciliation flag
    IF v_order.order_status = 'cancelled' THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            new_data,
            actor_user_id,
            actor_role
        ) VALUES (
            'orders',
            v_order.id::text,
            'INSERT',
            jsonb_build_object(
                'event', 'CAPTURED_PAYMENT_ON_CANCELLED_ORDER',
                'order_number', v_order.order_number,
                'razorpay_payment_id', p_razorpay_payment_id,
                'amount', p_payment_amount
            ),
            v_customer_auth_id,
            'system'
        );
        RAISE EXCEPTION 'ORDER_ALREADY_CANCELLED: Order % has already been cancelled.', v_order.order_number USING ERRCODE = 'P0013';
    END IF;

    -- Validate Payment Amount Match
    IF p_payment_amount IS NOT NULL AND ABS(p_payment_amount - v_order.final_payable_amount) > 0.01 THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            new_data,
            actor_user_id,
            actor_role
        ) VALUES (
            'orders',
            v_order.id::text,
            'INSERT',
            jsonb_build_object(
                'event', 'PAYMENT_AMOUNT_MISMATCH',
                'order_number', v_order.order_number,
                'expected_amount', v_order.final_payable_amount,
                'received_amount', p_payment_amount,
                'razorpay_payment_id', p_razorpay_payment_id
            ),
            v_customer_auth_id,
            'system'
        );
        RAISE EXCEPTION 'AMOUNT_MISMATCH: Expected ₹%, received ₹% for order %.', 
            v_order.final_payable_amount, p_payment_amount, v_order.order_number 
            USING ERRCODE = 'P0014';
    END IF;

    -- Extract verified gateway captured timestamp (from top-level created_at)
    v_captured_at := COALESCE(p_gateway_event_created_at, now());

    -- Delivery Cutoff Calculation using verified gateway capture timestamp in Asia/Kolkata timezone
    v_is_before_cutoff := ((v_captured_at AT TIME ZONE 'Asia/Kolkata')::time < '20:00:00'::time);
    
    IF v_is_before_cutoff THEN
        v_delivery_date := (v_captured_at AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day';
    ELSE
        v_delivery_date := (v_captured_at AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '2 days';
    END IF;

    -- Determine specific online payment sub-method if present in payload
    v_method_str := LOWER(COALESCE(p_gateway_payload->>'method', ''));
    IF v_method_str = 'upi' THEN
        v_payment_method := 'online_upi'::payment_method_type;
    ELSIF v_method_str IN ('card', 'debit', 'credit') THEN
        v_payment_method := 'online_card'::payment_method_type;
    ELSIF v_method_str IN ('netbanking', 'bank') THEN
        v_payment_method := 'online_netbanking'::payment_method_type;
    ELSE
        v_payment_method := 'online_card'::payment_method_type;
    END IF;

    -- Upsert Payment Record
    INSERT INTO payments (
        order_id,
        payment_method,
        amount,
        status,
        gateway_provider,
        gateway_transaction_id,
        gateway_order_id,
        webhook_event_id,
        gateway_response,
        gateway_captured_at,
        webhook_received_at,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_order.id,
        v_payment_method,
        v_order.final_payable_amount,
        'completed'::payment_status_type,
        'razorpay',
        p_razorpay_payment_id,
        p_razorpay_order_id,
        p_webhook_event_id,
        p_gateway_payload,
        v_captured_at,
        now(),
        'INR',
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_payment_id;

    -- Update Order to Confirmed State
    UPDATE orders
    SET 
        order_status = 'confirmed'::order_status_type,
        payment_status = 'completed'::payment_status_type,
        payment_method = v_payment_method,
        confirmed_at = v_captured_at,
        is_before_cutoff = v_is_before_cutoff,
        delivery_date = v_delivery_date,
        delivery_slot_start = v_slot_start,
        delivery_slot_end = v_slot_end,
        updated_at = now()
    WHERE id = v_order.id;

    -- Mark Webhook Event as Processed if provided
    IF p_webhook_event_id IS NOT NULL THEN
        UPDATE payment_webhook_events
        SET 
            processed_status = 'processed'::webhook_status_type,
            processed_at = now(),
            order_id = v_order.id
        WHERE id = p_webhook_event_id;
    END IF;

    -- Audit Log Entry
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        v_order.id::text,
        'INSERT',
        jsonb_build_object(
            'event', 'ONLINE_PAYMENT_CAPTURED_AND_CONFIRMED',
            'order_number', v_order.order_number,
            'razorpay_payment_id', p_razorpay_payment_id,
            'razorpay_order_id', p_razorpay_order_id,
            'final_payable_amount', v_order.final_payable_amount,
            'delivery_date', v_delivery_date,
            'is_before_cutoff', v_is_before_cutoff,
            'gateway_captured_at', v_captured_at
        ),
        v_customer_auth_id,
        'authenticated'
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_duplicate_confirmation', false,
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'order_status', 'confirmed',
        'payment_status', 'completed',
        'payment_method', v_payment_method,
        'final_payable_amount', v_order.final_payable_amount,
        'confirmed_at', v_captured_at,
        'delivery_date', v_delivery_date,
        'delivery_slot', '10:00 AM – 01:00 PM',
        'is_before_cutoff', v_is_before_cutoff
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION confirm_online_payment_capture(UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, TIMESTAMPTZ, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_online_payment_capture(UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, TIMESTAMPTZ, UUID, JSONB) TO authenticated, service_role;


-- 6. Online Payment Failure Handler (Never downgrades confirmed orders)
CREATE OR REPLACE FUNCTION record_online_payment_failure(
    p_order_id UUID,
    p_razorpay_order_id VARCHAR(100),
    p_razorpay_payment_id VARCHAR(100),
    p_error_code VARCHAR(100) DEFAULT NULL,
    p_error_description TEXT DEFAULT NULL,
    p_webhook_event_id UUID DEFAULT NULL,
    p_gateway_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_customer_auth_id UUID;
BEGIN
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Order not found');
    END IF;

    SELECT auth_user_id INTO v_customer_auth_id 
    FROM customers 
    WHERE id = v_order.customer_id;

    -- Monotonic Rule: Do not downgrade an already confirmed order
    IF v_order.order_status = 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'order_id', v_order.id,
            'ignored', true,
            'reason', 'Order is already confirmed; failure ignored.'
        );
    END IF;

    -- Record failed payment attempt
    INSERT INTO payments (
        order_id,
        payment_method,
        amount,
        status,
        gateway_provider,
        gateway_transaction_id,
        gateway_order_id,
        webhook_event_id,
        gateway_response,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_order.id,
        'online_card'::payment_method_type,
        v_order.final_payable_amount,
        'failed'::payment_status_type,
        'razorpay',
        p_razorpay_payment_id,
        p_razorpay_order_id,
        p_webhook_event_id,
        p_gateway_payload,
        'INR',
        now(),
        now()
    );

    IF p_webhook_event_id IS NOT NULL THEN
        UPDATE payment_webhook_events
        SET 
            processed_status = 'processed'::webhook_status_type,
            processed_at = now(),
            order_id = v_order.id
        WHERE id = p_webhook_event_id;
    END IF;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        v_order.id::text,
        'INSERT',
        jsonb_build_object(
            'event', 'ONLINE_PAYMENT_ATTEMPT_FAILED',
            'order_number', v_order.order_number,
            'error_code', p_error_code,
            'error_description', p_error_description,
            'razorpay_payment_id', p_razorpay_payment_id
        ),
        v_customer_auth_id,
        'system'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'order_status', v_order.order_status,
        'payment_status', 'failed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION record_online_payment_failure(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_online_payment_failure(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, UUID, JSONB) TO authenticated, service_role;


-- 7. Payment Pending Expiry & Promo Reservation Cleanup Function
CREATE OR REPLACE FUNCTION expire_stale_payment_pending_orders()
RETURNS JSONB AS $$
DECLARE
    v_expiry_minutes INT := 15;
    v_stale_order RECORD;
    v_customer_auth_id UUID;
    v_count INT := 0;
BEGIN
    SELECT COALESCE((value->>'minutes')::int, 15) INTO v_expiry_minutes
    FROM app_settings WHERE key = 'online_payment_expiry_minutes';

    FOR v_stale_order IN 
        SELECT id, order_number, customer_id 
        FROM orders 
        WHERE order_status = 'payment_pending' 
          AND placed_at < (now() - (v_expiry_minutes || ' minutes')::interval)
        FOR UPDATE
    LOOP
        SELECT auth_user_id INTO v_customer_auth_id 
        FROM customers 
        WHERE id = v_stale_order.customer_id;

        -- Cancel the order
        UPDATE orders
        SET 
            order_status = 'cancelled'::order_status_type,
            cancellation_reason = format('Online payment pending timeout (> %s minutes)', v_expiry_minutes),
            cancelled_at = now(),
            updated_at = now()
        WHERE id = v_stale_order.id;

        -- Release promo reservation
        UPDATE promotion_usage
        SET 
            status = 'released'::promo_usage_status_type,
            released_at = now(),
            release_reason = 'Payment pending timeout'
        WHERE order_id = v_stale_order.id AND status = 'reserved';

        -- Audit Log
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            new_data,
            actor_user_id,
            actor_role
        ) VALUES (
            'orders',
            v_stale_order.id::text,
            'INSERT',
            jsonb_build_object(
                'event', 'STALE_PAYMENT_PENDING_EXPIRED',
                'order_number', v_stale_order.order_number,
                'timeout_minutes', v_expiry_minutes
            ),
            v_customer_auth_id,
            'system'
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'expired_orders_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION expire_stale_payment_pending_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_stale_payment_pending_orders() TO service_role;


-- 8. Payment Reconciliation Issues Inspector (Owner / Manager only)
CREATE OR REPLACE FUNCTION get_payment_reconciliation_issues()
RETURNS JSONB AS $$
DECLARE
    v_issues JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    -- Check 1: Payments with completed status where order is not confirmed
    FOR v_rec IN
        SELECT p.id AS payment_id, p.order_id, o.order_number, p.amount, p.gateway_transaction_id, o.order_status
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.status = 'completed' AND o.order_status <> 'confirmed'
    LOOP
        v_issues := v_issues || jsonb_build_object(
            'type', 'COMPLETED_PAYMENT_UNCONFIRMED_ORDER',
            'payment_id', v_rec.payment_id,
            'order_id', v_rec.order_id,
            'order_number', v_rec.order_number,
            'amount', v_rec.amount,
            'gateway_tx_id', v_rec.gateway_transaction_id,
            'order_status', v_rec.order_status
        );
    END LOOP;

    -- Check 2: Amount discrepancies
    FOR v_rec IN
        SELECT p.id AS payment_id, p.order_id, o.order_number, p.amount AS paid_amount, o.final_payable_amount AS order_amount
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE p.status = 'completed' AND p.amount <> o.final_payable_amount
    LOOP
        v_issues := v_issues || jsonb_build_object(
            'type', 'PAYMENT_AMOUNT_MISMATCH',
            'payment_id', v_rec.payment_id,
            'order_id', v_rec.order_id,
            'order_number', v_rec.order_number,
            'paid_amount', v_rec.paid_amount,
            'order_amount', v_rec.order_amount
        );
    END LOOP;

    -- Check 3: Webhook events with failed processing
    FOR v_rec IN
        SELECT id, event_id, event_type, processing_error, created_at
        FROM payment_webhook_events
        WHERE processed_status = 'failed'
    LOOP
        v_issues := v_issues || jsonb_build_object(
            'type', 'FAILED_WEBHOOK_EVENT',
            'webhook_id', v_rec.id,
            'event_id', v_rec.event_id,
            'event_type', v_rec.event_type,
            'error', v_rec.processing_error,
            'received_at', v_rec.created_at
        );
    END LOOP;

    RETURN jsonb_build_object(
        'total_issues_count', jsonb_array_length(v_issues),
        'issues', v_issues,
        'checked_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_payment_reconciliation_issues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_payment_reconciliation_issues() TO authenticated, service_role;

COMMIT;
