-- =============================================================================
-- SABJIWALA: PRODUCT CATALOG, VARIANTS & DAILY PRICING MANAGEMENT
-- =============================================================================

BEGIN;

-- 1. Storage Bucket for Product Images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- Storage Policies on storage.objects
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Staff can upload product images" ON storage.objects;
CREATE POLICY "Staff can upload product images" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'product-images' AND 
        (public.has_role('owner') OR public.has_role('manager'))
    );

DROP POLICY IF EXISTS "Staff can update product images" ON storage.objects;
CREATE POLICY "Staff can update product images" ON storage.objects
    FOR UPDATE TO authenticated USING (
        bucket_id = 'product-images' AND 
        (public.has_role('owner') OR public.has_role('manager'))
    ) WITH CHECK (
        bucket_id = 'product-images' AND 
        (public.has_role('owner') OR public.has_role('manager'))
    );

DROP POLICY IF EXISTS "Staff can delete product images" ON storage.objects;
CREATE POLICY "Staff can delete product images" ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'product-images' AND 
        (public.has_role('owner') OR public.has_role('manager'))
    );


-- 2. Drop and Re-create Public Catalog Views
DROP VIEW IF EXISTS public_catalog_variants CASCADE;
DROP VIEW IF EXISTS public_catalog_products CASCADE;

CREATE VIEW public_catalog_products 
WITH (security_invoker = true) AS
SELECT 
    p.id,
    p.category_id,
    p.base_unit_id,
    p.slug,
    p.name_en,
    p.name_gu,
    p.description_en,
    p.description_gu,
    p.image_url,
    p.is_seasonal,
    p.is_in_stock,
    p.display_order
FROM products p
WHERE p.is_active = true;

CREATE VIEW public_catalog_variants 
WITH (security_invoker = true) AS
SELECT 
    pv.id,
    pv.product_id,
    pv.unit_id,
    pv.sku,
    pv.variant_name_en,
    pv.variant_name_gu,
    pv.multiplier_to_base_unit,
    pv.selling_price,
    pv.min_order_qty,
    pv.max_order_qty,
    pv.is_default,
    pv.is_active,
    pv.display_order,
    u.code AS unit_code,
    u.name_en AS unit_name_en,
    u.name_gu AS unit_name_gu
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
JOIN product_units u ON pv.unit_id = u.id
WHERE pv.is_active = true AND p.is_active = true;


-- 3. Atomic Single Variant Price Update RPC
CREATE OR REPLACE FUNCTION update_variant_price(
    p_variant_id UUID,
    p_new_price NUMERIC,
    p_change_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN;
    v_variant RECORD;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can update selling prices.';
    END IF;

    IF p_new_price IS NULL OR p_new_price < 0 THEN
        RAISE EXCEPTION 'Invalid selling price: % (must be >= 0)', p_new_price;
    END IF;

    SELECT * INTO v_variant 
    FROM product_variants 
    WHERE id = p_variant_id FOR UPDATE;

    IF v_variant.id IS NULL THEN
        RAISE EXCEPTION 'Product variant % not found.', p_variant_id;
    END IF;

    -- Update variant selling price
    UPDATE product_variants 
    SET selling_price = p_new_price,
        updated_at = now()
    WHERE id = p_variant_id;

    -- Insert append-only price history
    INSERT INTO selling_price_history (
        product_variant_id,
        selling_price,
        changed_by,
        change_reason,
        effective_at,
        created_at
    ) VALUES (
        p_variant_id,
        p_new_price,
        v_user_id,
        p_change_reason,
        now(),
        now()
    );

    RETURN jsonb_build_object(
        'variant_id', p_variant_id,
        'old_price', v_variant.selling_price,
        'new_price', p_new_price,
        'updated_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION update_variant_price(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_variant_price(UUID, NUMERIC, TEXT) TO authenticated;


-- 4. Bulk Daily Selling Price Update RPC
CREATE OR REPLACE FUNCTION bulk_update_variant_prices(
    p_updates JSONB,
    p_change_reason TEXT DEFAULT 'Daily Morning Price Revision'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN;
    v_item JSONB;
    v_variant_id UUID;
    v_new_price NUMERIC;
    v_updated_count INT := 0;
    v_results JSONB := '[]'::jsonb;
    v_var_res JSONB;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can update selling prices.';
    END IF;

    IF jsonb_array_length(p_updates) = 0 THEN
        RETURN jsonb_build_object('success', true, 'updated_count', 0, 'items', '[]'::jsonb);
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_new_price := (v_item->>'selling_price')::numeric;

        IF v_new_price IS NULL OR v_new_price < 0 THEN
            RAISE EXCEPTION 'Invalid price for variant %: %', v_variant_id, v_new_price;
        END IF;

        SELECT update_variant_price(v_variant_id, v_new_price, p_change_reason) INTO v_var_res;
        v_results := v_results || jsonb_build_array(v_var_res);
        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'items', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION bulk_update_variant_prices(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bulk_update_variant_prices(JSONB, TEXT) TO authenticated;


-- 5. Admin Category Management RPC
CREATE OR REPLACE FUNCTION admin_save_category(
    p_id UUID DEFAULT NULL,
    p_slug VARCHAR(100) DEFAULT '',
    p_name_en VARCHAR(100) DEFAULT '',
    p_name_gu VARCHAR(100) DEFAULT '',
    p_image_url TEXT DEFAULT NULL,
    p_display_order INT DEFAULT 0,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    v_is_authorized BOOLEAN;
    v_cat_id UUID := p_id;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can manage categories.';
    END IF;

    IF TRIM(p_name_en) = '' OR TRIM(p_name_gu) = '' THEN
        RAISE EXCEPTION 'Category English and Gujarati names are required.';
    END IF;

    IF v_cat_id IS NOT NULL THEN
        UPDATE categories 
        SET slug = COALESCE(NULLIF(TRIM(p_slug), ''), slug),
            name_en = TRIM(p_name_en),
            name_gu = TRIM(p_name_gu),
            image_url = p_image_url,
            display_order = p_display_order,
            is_active = p_is_active,
            updated_at = now()
        WHERE id = v_cat_id;
    ELSE
        INSERT INTO categories (
            slug,
            name_en,
            name_gu,
            image_url,
            display_order,
            is_active
        ) VALUES (
            LOWER(TRIM(COALESCE(NULLIF(p_slug, ''), REPLACE(p_name_en, ' ', '-')))),
            TRIM(p_name_en),
            TRIM(p_name_gu),
            p_image_url,
            p_display_order,
            p_is_active
        ) RETURNING id INTO v_cat_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'category_id', v_cat_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION admin_save_category(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, INT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_category(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, INT, BOOLEAN) TO authenticated;


-- 6. Admin Product Management RPC
CREATE OR REPLACE FUNCTION admin_save_product(
    p_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_base_unit_id UUID DEFAULT NULL,
    p_slug VARCHAR(150) DEFAULT '',
    p_name_en VARCHAR(150) DEFAULT '',
    p_name_gu VARCHAR(150) DEFAULT '',
    p_description_en TEXT DEFAULT NULL,
    p_description_gu TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_is_seasonal BOOLEAN DEFAULT false,
    p_is_in_stock BOOLEAN DEFAULT true,
    p_is_active BOOLEAN DEFAULT true,
    p_display_order INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_is_authorized BOOLEAN;
    v_prod_id UUID := p_id;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can manage products.';
    END IF;

    IF TRIM(p_name_en) = '' OR TRIM(p_name_gu) = '' THEN
        RAISE EXCEPTION 'Product English and Gujarati names are required.';
    END IF;

    IF p_category_id IS NULL OR p_base_unit_id IS NULL THEN
        RAISE EXCEPTION 'Category and base unit are required.';
    END IF;

    IF v_prod_id IS NOT NULL THEN
        UPDATE products 
        SET category_id = p_category_id,
            base_unit_id = p_base_unit_id,
            slug = COALESCE(NULLIF(TRIM(p_slug), ''), slug),
            name_en = TRIM(p_name_en),
            name_gu = TRIM(p_name_gu),
            description_en = p_description_en,
            description_gu = p_description_gu,
            image_url = p_image_url,
            is_seasonal = p_is_seasonal,
            is_in_stock = p_is_in_stock,
            is_active = p_is_active,
            display_order = p_display_order,
            updated_at = now()
        WHERE id = v_prod_id;
    ELSE
        INSERT INTO products (
            category_id,
            base_unit_id,
            slug,
            name_en,
            name_gu,
            description_en,
            description_gu,
            image_url,
            is_seasonal,
            is_in_stock,
            is_active,
            display_order
        ) VALUES (
            p_category_id,
            p_base_unit_id,
            LOWER(TRIM(COALESCE(NULLIF(p_slug, ''), REPLACE(p_name_en, ' ', '-')))),
            TRIM(p_name_en),
            TRIM(p_name_gu),
            p_description_en,
            p_description_gu,
            p_image_url,
            p_is_seasonal,
            p_is_in_stock,
            p_is_active,
            p_display_order
        ) RETURNING id INTO v_prod_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'product_id', v_prod_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION admin_save_product(UUID, UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_product(UUID, UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT) TO authenticated;


-- 7. Admin Product Variant Management RPC
CREATE OR REPLACE FUNCTION admin_save_variant(
    p_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_unit_id UUID DEFAULT NULL,
    p_sku VARCHAR(50) DEFAULT NULL,
    p_variant_name_en VARCHAR(100) DEFAULT '',
    p_variant_name_gu VARCHAR(100) DEFAULT '',
    p_multiplier_to_base_unit NUMERIC DEFAULT 1.0,
    p_selling_price NUMERIC DEFAULT 0.0,
    p_current_estimated_cost NUMERIC DEFAULT 0.0,
    p_min_order_qty NUMERIC DEFAULT 1.0,
    p_max_order_qty NUMERIC DEFAULT 20.0,
    p_is_default BOOLEAN DEFAULT false,
    p_is_active BOOLEAN DEFAULT true,
    p_display_order INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN;
    v_variant_id UUID := p_id;
    v_old_price NUMERIC;
BEGIN
    SELECT (public.has_role('owner') OR public.has_role('manager')) INTO v_is_authorized;
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner and Manager roles can manage product variants.';
    END IF;

    IF p_product_id IS NULL OR p_unit_id IS NULL THEN
        RAISE EXCEPTION 'Product ID and Unit ID are required.';
    END IF;

    IF p_selling_price < 0 THEN
        RAISE EXCEPTION 'Selling price cannot be negative.';
    END IF;

    -- If default, clear other defaults on product
    IF p_is_default THEN
        UPDATE product_variants 
        SET is_default = false 
        WHERE product_id = p_product_id;
    END IF;

    IF v_variant_id IS NOT NULL THEN
        SELECT selling_price INTO v_old_price 
        FROM product_variants 
        WHERE id = v_variant_id;

        UPDATE product_variants 
        SET unit_id = p_unit_id,
            sku = p_sku,
            variant_name_en = TRIM(p_variant_name_en),
            variant_name_gu = TRIM(p_variant_name_gu),
            multiplier_to_base_unit = p_multiplier_to_base_unit,
            selling_price = p_selling_price,
            current_estimated_cost = COALESCE(p_current_estimated_cost, current_estimated_cost),
            min_order_qty = p_min_order_qty,
            max_order_qty = p_max_order_qty,
            is_default = p_is_default,
            is_active = p_is_active,
            display_order = p_display_order,
            updated_at = now()
        WHERE id = v_variant_id;

        -- If price changed, insert into history
        IF v_old_price IS DISTINCT FROM p_selling_price THEN
            INSERT INTO selling_price_history (
                product_variant_id,
                selling_price,
                changed_by,
                change_reason,
                effective_at,
                created_at
            ) VALUES (
                v_variant_id,
                p_selling_price,
                v_user_id,
                'Updated via variant editor',
                now(),
                now()
            );
        END IF;
    ELSE
        INSERT INTO product_variants (
            product_id,
            unit_id,
            sku,
            variant_name_en,
            variant_name_gu,
            multiplier_to_base_unit,
            selling_price,
            current_estimated_cost,
            min_order_qty,
            max_order_qty,
            is_default,
            is_active,
            display_order
        ) VALUES (
            p_product_id,
            p_unit_id,
            p_sku,
            TRIM(p_variant_name_en),
            TRIM(p_variant_name_gu),
            p_multiplier_to_base_unit,
            p_selling_price,
            COALESCE(p_current_estimated_cost, 0.0),
            p_min_order_qty,
            p_max_order_qty,
            p_is_default,
            p_is_active,
            p_display_order
        ) RETURNING id INTO v_variant_id;

        -- Initial price history
        INSERT INTO selling_price_history (
            product_variant_id,
            selling_price,
            changed_by,
            change_reason,
            effective_at,
            created_at
        ) VALUES (
            v_variant_id,
            p_selling_price,
            v_user_id,
            'Initial variant creation',
            now(),
            now()
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'variant_id', v_variant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION admin_save_variant(UUID, UUID, UUID, VARCHAR, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_variant(UUID, UUID, UUID, VARCHAR, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INT) TO authenticated;

COMMIT;
