-- ============================================================
-- Daily Mandi Rates & Best-Variant Module
-- Date-wise APMC (Halol Mandi) purchase rates for the FULL catalog,
-- settable from one admin screen alongside daily selling prices and
-- the customer-facing default pack (gm/kg) — without opening the
-- catalog editor.
--
-- Applied: 2026-08-22
-- ============================================================

-- 1. Table: one mandi purchase rate per product per day
CREATE TABLE IF NOT EXISTS daily_mandi_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_date DATE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    purchase_rate_per_kg NUMERIC(10, 2) NOT NULL CHECK (purchase_rate_per_kg >= 0),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_mandi_rates_date_product
    ON daily_mandi_rates(rate_date, product_id);

CREATE INDEX IF NOT EXISTS idx_daily_mandi_rates_date
    ON daily_mandi_rates(rate_date);

-- Purchase cost data is internal: no direct table access for API roles.
-- All reads/writes go through the SECURITY DEFINER RPCs below, which
-- verify owner/manager roles internally.
REVOKE ALL ON daily_mandi_rates FROM PUBLIC, anon, authenticated;


-- 2. RPC: read the saved mandi rates for one date
CREATE OR REPLACE FUNCTION get_daily_mandi_rates(p_rate_date DATE)
RETURNS JSONB AS $$
DECLARE
    v_is_authorized BOOLEAN;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can view mandi rates.';
    END IF;

    IF p_rate_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_DATE: A rate date is required.';
    END IF;

    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'product_id', r.product_id,
                'purchase_rate_per_kg', r.purchase_rate_per_kg,
                'notes', r.notes,
                'updated_at', r.updated_at
            )
            ORDER BY r.updated_at DESC
        )
        FROM daily_mandi_rates r
        WHERE r.rate_date = p_rate_date
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_daily_mandi_rates(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_daily_mandi_rates(DATE) TO authenticated;


-- 3. RPC: bulk upsert mandi rates for one date
--    p_rates = [{"product_id": "...", "purchase_rate_per_kg": 32.5, "notes": "..."}]
CREATE OR REPLACE FUNCTION upsert_daily_mandi_rates(
    p_rate_date DATE,
    p_rates JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN;
    v_item JSONB;
    v_product_id UUID;
    v_rate NUMERIC(10, 2);
    v_notes TEXT;
    v_saved_count INT := 0;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can set mandi rates.';
    END IF;

    IF p_rate_date IS NULL THEN
        RAISE EXCEPTION 'INVALID_DATE: A rate date is required.' USING ERRCODE = 'P0001';
    END IF;

    IF p_rates IS NULL OR jsonb_typeof(p_rates) <> 'array' THEN
        RAISE EXCEPTION 'INVALID_RATES: p_rates must be a JSON array.' USING ERRCODE = 'P0002';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_rates)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_rate := (v_item->>'purchase_rate_per_kg')::numeric;
        v_notes := v_item->>'notes';

        IF v_product_id IS NULL THEN
            RAISE EXCEPTION 'INVALID_PRODUCT: product_id is required for every rate.' USING ERRCODE = 'P0003';
        END IF;

        IF v_rate IS NULL OR v_rate < 0 THEN
            RAISE EXCEPTION 'INVALID_RATE: Rate for product % must be >= 0.', v_product_id USING ERRCODE = 'P0004';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM products p WHERE p.id = v_product_id) THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', v_product_id USING ERRCODE = 'P0005';
        END IF;

        INSERT INTO daily_mandi_rates (rate_date, product_id, purchase_rate_per_kg, notes, created_by)
        VALUES (p_rate_date, v_product_id, v_rate, v_notes, v_user_id)
        ON CONFLICT (rate_date, product_id)
        DO UPDATE SET
            purchase_rate_per_kg = EXCLUDED.purchase_rate_per_kg,
            notes = EXCLUDED.notes,
            updated_at = now();

        v_saved_count := v_saved_count + 1;

        INSERT INTO audit_logs (table_name, record_id, action, new_data, actor_user_id, actor_role)
        VALUES (
            'daily_mandi_rates',
            p_rate_date::text || ':' || v_product_id::text,
            'INSERT',
            jsonb_build_object(
                'event', 'DAILY_MANDI_RATE_UPSERT',
                'rate_date', p_rate_date,
                'product_id', v_product_id,
                'purchase_rate_per_kg', v_rate
            ),
            v_user_id,
            'manager'
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'saved_count', v_saved_count, 'rate_date', p_rate_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION upsert_daily_mandi_rates(DATE, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_daily_mandi_rates(DATE, JSONB) TO authenticated;


-- 4. RPC: make one variant the customer-facing default pack for its product.
--    The storefront pre-selects the default variant (ProductCard), so this is
--    how the "best gm/kg pack" is chosen without editing the catalog.
CREATE OR REPLACE FUNCTION set_default_product_variant(p_variant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN;
    v_variant RECORD;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can change the default pack.';
    END IF;

    SELECT * INTO v_variant FROM product_variants WHERE id = p_variant_id FOR UPDATE;
    IF v_variant.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'VARIANT_NOT_FOUND', 'message', 'Variant not found.');
    END IF;

    IF NOT v_variant.is_active THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'VARIANT_INACTIVE', 'message', 'Cannot make an inactive pack the default.');
    END IF;

    UPDATE product_variants
    SET is_default = (id = p_variant_id)
    WHERE product_id = v_variant.product_id;

    INSERT INTO audit_logs (table_name, record_id, action, new_data, actor_user_id, actor_role)
    VALUES (
        'product_variants',
        p_variant_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'DEFAULT_VARIANT_SET',
            'product_id', v_variant.product_id,
            'default_variant_id', p_variant_id
        ),
        v_user_id,
        'manager'
    );

    RETURN jsonb_build_object(
        'success', true,
        'product_id', v_variant.product_id,
        'default_variant_id', p_variant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION set_default_product_variant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_default_product_variant(UUID) TO authenticated;
