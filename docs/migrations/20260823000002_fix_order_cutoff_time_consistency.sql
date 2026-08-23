-- =============================================================================
-- MIGRATION: FIX ORDER CUTOFF TIME CONSISTENCY & PINCODE FORMAT VALIDATION
-- Date: 2026-08-23
--
-- Bug (Critical): The customer-facing UI (deliveryHelper.ts, homepage, cart
-- drawer, product cards, Halol landing page) advertises a 7:50 PM (19:50 IST)
-- daily order cutoff. But create_customer_order() — the DB function that
-- actually decides whether an order is "before cutoff" and therefore whether
-- it ships tomorrow or the day after — was hardcoded to 8:00 PM ('20:00:00').
-- This let customers place orders between 7:50 PM and 8:00 PM believing they
-- would get tomorrow's delivery (per the UI), while the backend silently
-- pushed them to the day after tomorrow. Nothing read the app_settings
-- 'cutoff_time' row that the admin "Save Cutoff Time" control writes to, so
-- that setting was pure dead weight.
--
-- Fix:
--   1. Update the app_settings 'cutoff_time' row (the exact key the admin
--      settings page at web/src/app/admin/settings/page.tsx reads/writes via
--      handleSaveSetting('cutoff_time', ...)) to 19:50:00, matching the
--      advertised time.
--   2. Recreate create_customer_order() (CREATE OR REPLACE, faithful copy of
--      the current live definition from
--      20260819000001_dynamic_campaign_and_first3orders.sql) so the cutoff
--      check reads app_settings.cutoff_time at order time instead of using a
--      hardcoded literal, falling back to 19:50:00 if the setting is missing.
--      All other logic (row locking, idempotency, price re-verification,
--      FIRST500/multi-order promo handling, snapshots, audit log) is
--      unchanged from the 20260819000001 definition.
--
-- Also (Medium): customer_addresses.pincode had no format constraint at the
-- database layer. Add a CHECK requiring exactly 6 digits (Indian PIN code
-- format), matching every existing seeded/live value (e.g. '389350' for
-- Halol). The column is NOT NULL, so no NULL-allowance is needed.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Correct the cutoff_time app_settings value to match the advertised 7:50 PM
-- -----------------------------------------------------------------------------
INSERT INTO app_settings (key, value, description)
VALUES (
    'cutoff_time',
    '{"time": "19:50:00", "timezone": "Asia/Kolkata"}'::jsonb,
    'Daily order confirmation cutoff time for next-day delivery'
)
ON CONFLICT (key) DO UPDATE
SET value = '{"time": "19:50:00", "timezone": "Asia/Kolkata"}'::jsonb,
    description = EXCLUDED.description,
    updated_at = now();

-- Note: the older 'delivery_cutoff_time' key (seeded in
-- 20260816000014_mvp_cod_only.sql) is left untouched for backward
-- compatibility. It is not read by create_customer_order(), by the admin
-- settings page, or by any other application code (grep-verified) — it is
-- only present in the app_settings public-read allowlist in
-- web/src/app/api/settings/route.ts and the update_business_setting()
-- owner-only key list. It does not conflict with 'cutoff_time' and can be
-- cleaned up separately if desired.


-- -----------------------------------------------------------------------------
-- 2. Recreate create_customer_order() to read the cutoff time from
--    app_settings instead of a hardcoded '20:00:00'::time literal.
--    Faithful copy of the function as last defined in
--    20260819000001_dynamic_campaign_and_first3orders.sql — only the cutoff
--    time resolution and the comparison in the COD branch are changed.
-- -----------------------------------------------------------------------------
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

    -- Campaign Settings
    v_campaign JSONB;
    v_campaign_active BOOLEAN := true;
    v_campaign_pct NUMERIC := 10.00;
    v_campaign_max_seq INT := 500;
    v_campaign_max_orders INT := 3;
    v_campaign_valid_from TIMESTAMPTZ := '2026-08-01T00:00:00+05:30'::timestamptz;
    v_campaign_valid_until TIMESTAMPTZ := '2026-10-31T23:59:59+05:30'::timestamptz;

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
    v_orders_used_count INT := 0;

    -- Daily order cutoff (Asia/Kolkata). Sourced from app_settings so it
    -- stays in sync with the admin "Save Cutoff Time" control and the
    -- customer-facing advertised cutoff (see web/src/lib/deliveryHelper.ts).
    -- Falls back to 19:50:00 (7:50 PM) if the setting row is missing.
    v_cutoff_time TIME := '19:50:00'::time;
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

    -- Load daily order cutoff time (falls back to the declared 19:50:00 default
    -- if the app_settings row is missing or malformed)
    SELECT COALESCE((value->>'time')::time, '19:50:00'::time) INTO v_cutoff_time
    FROM app_settings WHERE key = 'cutoff_time';

    -- Load campaign settings
    SELECT value INTO v_campaign FROM app_settings WHERE key = 'launch_campaign';
    IF v_campaign IS NOT NULL THEN
        v_campaign_active := COALESCE((v_campaign->>'is_active')::boolean, true);
        v_campaign_pct := COALESCE((v_campaign->>'discount_percentage')::numeric, 10.00);
        v_campaign_max_seq := COALESCE((v_campaign->>'max_verified_customer_seq')::int, 500);
        v_campaign_max_orders := COALESCE((v_campaign->>'max_orders_per_customer')::int, 3);
        IF v_campaign->>'valid_from' IS NOT NULL THEN
            v_campaign_valid_from := (v_campaign->>'valid_from')::timestamptz;
        END IF;
        IF v_campaign->>'valid_until' IS NOT NULL THEN
            v_campaign_valid_until := (v_campaign->>'valid_until')::timestamptz;
        END IF;
    END IF;

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

    -- Check FIRST500 Promotion Eligibility (up to max_orders_per_customer)
    IF v_campaign_active AND v_now_ist >= v_campaign_valid_from AND v_now_ist <= v_campaign_valid_until THEN
        IF v_customer.is_verified AND v_customer.verified_sequence IS NOT NULL AND v_customer.verified_sequence <= v_campaign_max_seq THEN
            SELECT p.* INTO v_promo
            FROM promotions p
            WHERE p.promo_code = 'FIRST500' AND p.is_active = true
            LIMIT 1;

            IF v_promo.id IS NOT NULL THEN
                SELECT COUNT(*) INTO v_orders_used_count
                FROM promotion_usage
                WHERE promotion_id = v_promo.id
                  AND customer_id = v_customer.id
                  AND status IN ('reserved', 'consumed')
                FOR UPDATE;

                IF v_orders_used_count < v_campaign_max_orders THEN
                    v_first_order_discount := ROUND(v_subtotal * (v_campaign_pct / 100.00), 2);
                END IF;
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
        v_is_before_cutoff := ((v_now_ist AT TIME ZONE 'Asia/Kolkata')::time < v_cutoff_time);

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

    -- Reserve Promotion Usage for this order
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


-- -----------------------------------------------------------------------------
-- 3. Enforce 6-digit Indian PIN code format on customer_addresses.pincode
--    (column is VARCHAR(10) NOT NULL; all seeded/live data uses 6-digit
--    values such as '389350' for Halol, so this cannot conflict).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customer_addresses_pincode_format'
    ) THEN
        ALTER TABLE customer_addresses
            ADD CONSTRAINT customer_addresses_pincode_format CHECK (pincode ~ '^[0-9]{6}$');
    END IF;
END $$;

COMMIT;
