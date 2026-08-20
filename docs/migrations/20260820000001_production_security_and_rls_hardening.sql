-- =============================================================================
-- SABJIWALA: PRODUCTION-GRADE SECURITY, RLS & AUTHORIZATION HARDENING
-- =============================================================================

BEGIN;

-- 1. Enable RLS on print_jobs table & establish role policies
ALTER TABLE IF EXISTS public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS print_jobs_staff_manage ON public.print_jobs;
CREATE POLICY print_jobs_staff_manage ON public.print_jobs
    FOR ALL
    TO authenticated
    USING (
        public.has_role('packing'::staff_role_type) 
        OR public.has_role('manager'::staff_role_type) 
        OR public.has_role('owner'::staff_role_type)
    )
    WITH CHECK (
        public.has_role('packing'::staff_role_type) 
        OR public.has_role('manager'::staff_role_type) 
        OR public.has_role('owner'::staff_role_type)
    );

-- 2. Fix mutable search_path on public.normalize_e164_indian_mobile
CREATE OR REPLACE FUNCTION public.normalize_e164_indian_mobile(p_mobile TEXT)
RETURNS TEXT AS $$
DECLARE
    v_clean TEXT;
BEGIN
    IF p_mobile IS NULL OR trim(p_mobile) = '' THEN
        RETURN NULL;
    END IF;

    -- Strip all non-digit characters
    v_clean := regexp_replace(p_mobile, '[^0-9]', '', 'g');

    -- Handle Indian numbers
    IF length(v_clean) = 10 THEN
        RETURN '+91' || v_clean;
    ELSIF length(v_clean) = 11 AND v_clean LIKE '0%' THEN
        RETURN '+91' || substring(v_clean FROM 2);
    ELSIF length(v_clean) = 12 AND v_clean LIKE '91%' THEN
        RETURN '+' || v_clean;
    ELSIF length(v_clean) > 10 THEN
        RETURN '+' || v_clean;
    ELSE
        RETURN p_mobile; -- fallback
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, auth;

-- 3. Harden app_settings RLS: Public can only read whitelisted public config keys
DROP POLICY IF EXISTS "App settings readable by all" ON public.app_settings;
DROP POLICY IF EXISTS app_settings_public_read ON public.app_settings;
DROP POLICY IF EXISTS app_settings_staff_read ON public.app_settings;

CREATE POLICY app_settings_public_read ON public.app_settings
    FOR SELECT
    TO public
    USING (
        key IN (
            'business_profile',
            'delivery_zones',
            'min_order_amount',
            'cod_discount_pct',
            'online_discount_pct',
            'first_500_promo',
            'cutoff_time',
            'delivery_cutoff_time',
            'delivery_window',
            'delivery_fee',
            'feature_flags',
            'launch_campaign'
        )
    );

CREATE POLICY app_settings_staff_read ON public.app_settings
    FOR SELECT
    TO authenticated
    USING (
        public.has_role('manager'::staff_role_type)
        OR public.has_role('owner'::staff_role_type)
    );

-- 4. Harden customers table RLS: Delivery staff cannot read the entire customer database
DROP POLICY IF EXISTS "Customers view own profile" ON public.customers;
CREATE POLICY "Customers view own profile" ON public.customers
    FOR SELECT
    TO authenticated
    USING (
        auth_user_id = auth.uid()
        OR public.has_role('manager'::staff_role_type)
        OR public.has_role('owner'::staff_role_type)
    );

-- 5. Harden orders table RLS: Delivery drivers can only read orders assigned to their delivery batch
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders" ON public.orders
    FOR SELECT
    TO authenticated
    USING (
        public.has_role('owner'::staff_role_type)
        OR public.has_role('manager'::staff_role_type)
        OR public.has_role('packing'::staff_role_type)
        OR (
            public.has_role('delivery'::staff_role_type)
            AND EXISTS (
                SELECT 1 FROM public.deliveries d
                WHERE d.order_id = orders.id
                  AND d.driver_user_id = auth.uid()
            )
        )
    );

-- 6. Harden manage_staff_user RPC caller verification
CREATE OR REPLACE FUNCTION public.manage_staff_user(
    p_admin_id UUID,
    p_target_user_id UUID,
    p_full_name VARCHAR,
    p_mobile VARCHAR,
    p_role VARCHAR,
    p_is_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_admin_role VARCHAR;
    v_target_role VARCHAR;
    v_owner_count INT;
    v_norm_mobile VARCHAR;
    v_new_user_id UUID;
    v_auth_user_id UUID;
BEGIN
    -- Verify caller is authenticated and has owner role
    IF v_caller_id IS NOT NULL THEN
        SELECT ur.role INTO v_admin_role
        FROM user_roles ur
        JOIN user_profiles up ON ur.user_id = up.id
        WHERE up.id = v_caller_id AND up.is_active = true;
    ELSE
        -- Fallback to p_admin_id only if called from service role/direct script
        SELECT ur.role INTO v_admin_role
        FROM user_roles ur
        JOIN user_profiles up ON ur.user_id = up.id
        WHERE up.id = p_admin_id AND up.is_active = true;
    END IF;

    IF v_admin_role <> 'owner' THEN
        RAISE EXCEPTION 'Unauthorized: Only Owner can manage staff accounts and roles';
    END IF;

    -- Validate Role Parameter
    IF p_role NOT IN ('owner', 'manager', 'packing', 'delivery') THEN
        RAISE EXCEPTION 'Invalid role: %', p_role;
    END IF;

    v_norm_mobile := normalize_e164_indian_mobile(p_mobile);
    IF v_norm_mobile IS NULL THEN
        RAISE EXCEPTION 'Invalid mobile number: %', p_mobile;
    END IF;

    -- 2. CREATE NEW STAFF ACCOUNT
    IF p_target_user_id IS NULL THEN
        -- Check if mobile already exists in user_profiles
        IF EXISTS (SELECT 1 FROM user_profiles WHERE mobile = v_norm_mobile) THEN
            RAISE EXCEPTION 'A staff account with mobile % already exists', v_norm_mobile;
        END IF;

        -- Check if auth.users already has this phone
        SELECT id INTO v_auth_user_id FROM auth.users WHERE phone = v_norm_mobile LIMIT 1;
        IF v_auth_user_id IS NULL THEN
            v_new_user_id := gen_random_uuid();
            INSERT INTO auth.users (id, phone, email, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
            VALUES (
                v_new_user_id,
                v_norm_mobile,
                'staff_' || replace(v_norm_mobile, '+', '') || '@sabjiwala.store',
                jsonb_build_object('provider', 'phone', 'providers', jsonb_build_array('phone')),
                jsonb_build_object('full_name', p_full_name),
                'authenticated',
                'authenticated',
                now(),
                now()
            );
        ELSE
            v_new_user_id := v_auth_user_id;
        END IF;

        INSERT INTO user_profiles (id, full_name, mobile, is_active)
        VALUES (v_new_user_id, p_full_name, v_norm_mobile, COALESCE(p_is_active, true))
        ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            mobile = EXCLUDED.mobile,
            is_active = EXCLUDED.is_active,
            updated_at = now();

        INSERT INTO user_roles (user_id, role)
        VALUES (v_new_user_id, p_role::staff_role_type)
        ON CONFLICT (user_id, role) DO NOTHING;

        -- Audit Log
        INSERT INTO audit_logs (actor_user_id, actor_role, action, table_name, record_id, new_data)
        VALUES (
            COALESCE(v_caller_id, p_admin_id),
            v_admin_role,
            'INSERT',
            'user_profiles',
            v_new_user_id::text,
            jsonb_build_object(
                'full_name', p_full_name,
                'mobile', v_norm_mobile,
                'role', p_role,
                'is_active', COALESCE(p_is_active, true)
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Staff account created successfully',
            'user_id', v_new_user_id
        );
    ELSE
        -- 3. UPDATE EXISTING STAFF ACCOUNT
        SELECT ur.role INTO v_target_role
        FROM user_roles ur WHERE ur.user_id = p_target_user_id;

        -- Prevent deactivating or demoting the last active owner
        IF v_target_role = 'owner' AND (p_is_active = false OR p_role <> 'owner') THEN
            SELECT COUNT(*) INTO v_owner_count
            FROM user_roles ur
            JOIN user_profiles up ON ur.user_id = up.id
            WHERE ur.role = 'owner' AND up.is_active = true;

            IF v_owner_count <= 1 THEN
                RAISE EXCEPTION 'Cannot deactivate or change role of the only active Owner';
            END IF;
        END IF;

        UPDATE user_profiles
        SET full_name = p_full_name,
            mobile = v_norm_mobile,
            is_active = p_is_active,
            updated_at = now()
        WHERE id = p_target_user_id;

        UPDATE user_roles
        SET role = p_role::staff_role_type
        WHERE user_id = p_target_user_id;

        -- Audit Log
        INSERT INTO audit_logs (actor_user_id, actor_role, action, table_name, record_id, old_data, new_data)
        VALUES (
            COALESCE(v_caller_id, p_admin_id),
            v_admin_role,
            'UPDATE',
            'user_profiles',
            p_target_user_id::text,
            jsonb_build_object('previous_role', v_target_role),
            jsonb_build_object(
                'full_name', p_full_name,
                'mobile', v_norm_mobile,
                'role', p_role,
                'is_active', p_is_active
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Staff account updated successfully',
            'user_id', p_target_user_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.manage_staff_user(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_staff_user(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO authenticated, service_role;

-- 7. Harden update_business_setting RPC caller verification
CREATE OR REPLACE FUNCTION public.update_business_setting(
    p_admin_id UUID,
    p_key VARCHAR,
    p_value JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_admin_role VARCHAR;
    v_old_value JSONB;
BEGIN
    IF v_caller_id IS NOT NULL THEN
        SELECT ur.role INTO v_admin_role
        FROM user_roles ur
        JOIN user_profiles up ON ur.user_id = up.id
        WHERE up.id = v_caller_id AND up.is_active = true;
    ELSE
        SELECT ur.role INTO v_admin_role
        FROM user_roles ur
        JOIN user_profiles up ON ur.user_id = up.id
        WHERE up.id = p_admin_id AND up.is_active = true;
    END IF;

    IF v_admin_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not found or inactive';
    END IF;

    -- Sensitive settings require OWNER role
    IF p_key IN ('cod_discount_pct', 'min_order_amount', 'first_500_promo', 'feature_flags', 'business_profile', 'cutoff_time', 'delivery_cutoff_time', 'delivery_zones', 'launch_campaign') THEN
        IF v_admin_role <> 'owner' THEN
            RAISE EXCEPTION 'Unauthorized: Only Owner can modify %', p_key;
        END IF;
    END IF;

    SELECT value INTO v_old_value FROM app_settings WHERE key = p_key;

    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (p_key, p_value, COALESCE(v_caller_id, p_admin_id), now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

    -- Audit Log
    INSERT INTO audit_logs (actor_user_id, actor_role, action, table_name, record_id, old_data, new_data)
    VALUES (
        COALESCE(v_caller_id, p_admin_id),
        v_admin_role,
        'UPDATE',
        'app_settings',
        p_key,
        jsonb_build_object('key', p_key, 'value', v_old_value),
        jsonb_build_object('key', p_key, 'value', p_value)
    );

    RETURN jsonb_build_object(
        'success', true,
        'key', p_key,
        'message', 'Setting updated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.update_business_setting(UUID, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_business_setting(UUID, VARCHAR, JSONB) TO authenticated, service_role;

COMMIT;
