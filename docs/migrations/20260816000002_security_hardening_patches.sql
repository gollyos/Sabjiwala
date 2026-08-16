-- =============================================================================
-- SECURITY HARDENING & LINTER RESOLUTIONS
-- Fixes view security invoker, missing RLS policies, mutable search_paths, and function permissions
-- =============================================================================

BEGIN;

-- 1. Explicit SECURITY INVOKER on Public Catalog Views
CREATE OR REPLACE VIEW public_catalog_products 
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
WHERE p.is_active = true AND p.is_in_stock = true;

CREATE OR REPLACE VIEW public_catalog_variants 
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
    pv.display_order
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE pv.is_active = true AND p.is_active = true AND p.is_in_stock = true;


-- 2. Complete Missing RLS Policies
-- payment_webhook_events
DROP POLICY IF EXISTS "Staff can view webhook events" ON payment_webhook_events;
CREATE POLICY "Staff can view webhook events" ON payment_webhook_events
    FOR ALL USING (public.is_internal_staff());

-- procurement_items
DROP POLICY IF EXISTS "Staff can view procurement items" ON procurement_items;
CREATE POLICY "Staff can view procurement items" ON procurement_items
    FOR SELECT USING (public.is_internal_staff());

DROP POLICY IF EXISTS "Managers and Owners can manage procurement items" ON procurement_items;
CREATE POLICY "Managers and Owners can manage procurement items" ON procurement_items
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));

-- promotions
DROP POLICY IF EXISTS "Public can view active promotions" ON promotions;
CREATE POLICY "Public can view active promotions" ON promotions
    FOR SELECT USING (is_active = true OR public.is_internal_staff());

DROP POLICY IF EXISTS "Owners can manage promotions" ON promotions;
CREATE POLICY "Owners can manage promotions" ON promotions
    FOR ALL USING (public.has_role('owner'));

-- promotion_usage
DROP POLICY IF EXISTS "Customers can view own promotion usage" ON promotion_usage;
CREATE POLICY "Customers can view own promotion usage" ON promotion_usage
    FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can view all promotion usage" ON promotion_usage;
CREATE POLICY "Staff can view all promotion usage" ON promotion_usage
    FOR SELECT USING (public.is_internal_staff());

-- selling_price_history
DROP POLICY IF EXISTS "Staff can view selling price history" ON selling_price_history;
CREATE POLICY "Staff can view selling price history" ON selling_price_history
    FOR SELECT USING (public.is_internal_staff());

DROP POLICY IF EXISTS "Managers and Owners can manage selling price history" ON selling_price_history;
CREATE POLICY "Managers and Owners can manage selling price history" ON selling_price_history
    FOR ALL USING (public.has_role('manager') OR public.has_role('owner'));


-- 3. Fix Functions with Mutable search_path
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, auth;

CREATE OR REPLACE FUNCTION trigger_prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are strictly append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql SET search_path = public, auth;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    today_str TEXT;
    seq_val BIGINT;
BEGIN
    today_str := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYMMDD');
    seq_val := nextval('order_number_seq');
    RETURN 'SBJ-' || today_str || '-' || lpad(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public, auth;


-- 4. Restrict Function Permissions
-- Revoke all execute from anon/public for sensitive triggers and procedures
REVOKE EXECUTE ON FUNCTION trigger_protect_customer_security_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_record_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION confirm_online_order(UUID, TIMESTAMPTZ, VARCHAR, VARCHAR, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION verify_customer_phone(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION create_customer_order(UUID, payment_method_type, JSONB, TEXT, TEXT, order_channel_type) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_customer_phone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_online_order(UUID, TIMESTAMPTZ, VARCHAR, VARCHAR, UUID) TO authenticated;

COMMIT;
