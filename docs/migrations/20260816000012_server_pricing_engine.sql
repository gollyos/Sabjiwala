-- =============================================================================
-- SABJIWALA: CART & SERVER-SIDE PRICING ENGINE (AUTHORITATIVE QUOTE)
-- =============================================================================

BEGIN;

-- 1. Ensure all settings exist in app_settings
INSERT INTO app_settings (key, value, description)
VALUES 
    ('delivery_fee', '{"amount": 0, "currency": "INR"}'::jsonb, 'Standard delivery fee configuration'),
    ('online_discount_pct', '{"is_active": true, "percentage": 0}'::jsonb, 'Online payment discount percentage')
ON CONFLICT (key) DO NOTHING;


-- 2. Authoritative Checkout Quote Calculator Function
CREATE OR REPLACE FUNCTION calculate_checkout_quote(
    p_items JSONB,
    p_payment_method VARCHAR(20) DEFAULT 'cod'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer RECORD;
    v_promo RECORD;
    v_payment_method VARCHAR(20);
    
    -- App settings
    v_min_order_amount NUMERIC := 200.00;
    v_cod_discount_pct NUMERIC := 2.00;
    v_online_discount_pct NUMERIC := 0.00;
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
    v_first500_reason TEXT := 'Sign in to check launch discount eligibility';
    v_already_used BOOLEAN := false;
    
    -- Payment Method Discount
    v_remaining_merchandise NUMERIC := 0.00;
    v_payment_discount_pct NUMERIC := 0.00;
    v_payment_discount_amount NUMERIC := 0.00;
    
    -- Final Payable
    v_final_payable NUMERIC := 0.00;
    
    -- Output arrays
    v_items_result JSONB := '[]'::jsonb;
    v_has_unavailable BOOLEAN := false;
BEGIN
    -- Normalize payment method
    v_payment_method := LOWER(TRIM(COALESCE(p_payment_method, 'cod')));
    IF v_payment_method NOT IN ('cod', 'online') THEN
        v_payment_method := 'cod';
    END IF;

    -- Load configured settings from app_settings
    SELECT COALESCE((value->>'amount')::numeric, 200.00) INTO v_min_order_amount
    FROM app_settings WHERE key = 'min_order_amount';

    SELECT COALESCE((value->>'percentage')::numeric, 2.00) INTO v_cod_discount_pct
    FROM app_settings WHERE key = 'cod_discount_pct' AND (value->>'is_active')::boolean = true;

    SELECT COALESCE((value->>'percentage')::numeric, 0.00) INTO v_online_discount_pct
    FROM app_settings WHERE key = 'online_discount_pct' AND (value->>'is_active')::boolean = true;

    SELECT COALESCE((value->>'amount')::numeric, 0.00) INTO v_delivery_fee
    FROM app_settings WHERE key = 'delivery_fee';

    -- Process each cart item independently
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_variant_id := (v_item->>'variant_id')::uuid;
            v_qty := COALESCE((v_item->>'quantity')::numeric, 0);

            IF v_variant_id IS NULL OR v_qty <= 0 THEN
                CONTINUE;
            END IF;

            -- Query current active variant and parent product
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

    -- Calculate Payment Method Discount (COD 2% vs Online 0%) on remaining merchandise
    v_remaining_merchandise := GREATEST(0.00, v_subtotal - v_first500_discount);

    IF v_payment_method = 'cod' THEN
        v_payment_discount_pct := v_cod_discount_pct;
        v_payment_discount_amount := ROUND(v_remaining_merchandise * (v_payment_discount_pct / 100.0), 2);
    ELSE
        v_payment_discount_pct := v_online_discount_pct;
        v_payment_discount_amount := ROUND(v_remaining_merchandise * (v_payment_discount_pct / 100.0), 2);
    END IF;

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
            'method', v_payment_method,
            'discount_percentage', v_payment_discount_pct,
            'discount_amount', v_payment_discount_amount
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

COMMIT;
