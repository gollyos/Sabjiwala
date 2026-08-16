-- =============================================================================
-- SABJIWALA: OWNER CONTROLS, BUSINESS SETTINGS & SECURITY HARDENING MODULE
-- =============================================================================

BEGIN;

-- 1. Seed Business Profile & Delivery Zones in app_settings
INSERT INTO app_settings (key, value, description)
VALUES 
(
    'business_profile',
    '{
        "business_name": "Sabjiwala",
        "business_name_gu": "શાકભાજીવાળા",
        "tagline": "Farm-Fresh Vegetables Delivered to Your Doorstep",
        "tagline_gu": "તાજા શાકભાજી સીધા તમારા ઘરઆંગણે",
        "support_mobile": "+919876543210",
        "whatsapp_number": "+919876543210",
        "business_address": "Shop No. 4, APMC Market Road, Halol, Panchmahal, Gujarat - 389350",
        "default_language": "gu_IN",
        "default_currency": "INR",
        "timezone": "Asia/Kolkata",
        "fssai_license": "20726000000000",
        "pwa_domain": "https://sabjiwala.store"
    }'::jsonb,
    'Official Sabjiwala business profile, legal address, contact details and regional localization'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

INSERT INTO app_settings (key, value, description)
VALUES 
(
    'delivery_zones',
    '[
        {
            "id": "zone_halol_town",
            "name_en": "Halol Town",
            "name_gu": "હાલોલ શહેર",
            "is_active": true,
            "delivery_fee": 0.00,
            "min_order_amount": 200.00,
            "estimated_delivery_time": "10:00 AM - 1:00 PM"
        },
        {
            "id": "zone_halol_gidc",
            "name_en": "Halol GIDC",
            "name_gu": "હાલોલ જીઆઈડીસી",
            "is_active": true,
            "delivery_fee": 0.00,
            "min_order_amount": 200.00,
            "estimated_delivery_time": "10:00 AM - 1:00 PM"
        },
        {
            "id": "zone_baska",
            "name_en": "Baska Road",
            "name_gu": "બાસકા રોડ",
            "is_active": true,
            "delivery_fee": 0.00,
            "min_order_amount": 200.00,
            "estimated_delivery_time": "10:00 AM - 1:00 PM"
        },
        {
            "id": "zone_pavagadh_road",
            "name_en": "Pavagadh Bypass Road",
            "name_gu": "પાવાગઢ બાયપાસ રોડ",
            "is_active": true,
            "delivery_fee": 0.00,
            "min_order_amount": 200.00,
            "estimated_delivery_time": "10:00 AM - 1:00 PM"
        }
    ]'::jsonb,
    'Supported Halol delivery service zones, delivery fee structure and coverage parameters'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

INSERT INTO app_settings (key, value, description)
VALUES 
(
    'feature_flags',
    '{
        "online_payments_enabled": false,
        "delivery_otp_enabled": false,
        "whatsapp_enabled": true,
        "direct_printing_enabled": true,
        "upi_at_delivery_enabled": true,
        "pilot_mode_enabled": true
    }'::jsonb,
    'Authoritative server-side feature toggles for payment methods, printing, and operational modes'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

-- 1.5 Expand audit_logs action length & ensure user_profiles default ID
ALTER TABLE audit_logs ALTER COLUMN action TYPE VARCHAR(50);
ALTER TABLE user_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Staff Management RPC Function
CREATE OR REPLACE FUNCTION manage_staff_user(
    p_admin_id UUID,
    p_target_user_id UUID,
    p_full_name VARCHAR,
    p_mobile VARCHAR,
    p_role VARCHAR,
    p_is_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_admin_role VARCHAR;
    v_target_role VARCHAR;
    v_owner_count INT;
    v_norm_mobile VARCHAR;
    v_new_user_id UUID;
    v_auth_user_id UUID;
BEGIN
    -- 1. Check Caller Authorization (Must be OWNER)
    SELECT ur.role INTO v_admin_role
    FROM user_roles ur
    JOIN user_profiles up ON ur.user_id = up.id
    WHERE up.id = p_admin_id AND up.is_active = true;

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
            p_admin_id,
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
            p_admin_id,
            v_admin_role,
            'STAFF_UPDATED',
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

REVOKE ALL ON FUNCTION manage_staff_user(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION manage_staff_user(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO authenticated, service_role;

-- 3. Update Business Setting RPC Function
CREATE OR REPLACE FUNCTION update_business_setting(
    p_admin_id UUID,
    p_key VARCHAR,
    p_value JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_admin_role VARCHAR;
    v_old_value JSONB;
BEGIN
    SELECT ur.role INTO v_admin_role
    FROM user_roles ur
    JOIN user_profiles up ON ur.user_id = up.id
    WHERE up.id = p_admin_id AND up.is_active = true;

    IF v_admin_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not found or inactive';
    END IF;

    -- Sensitive settings require OWNER role
    IF p_key IN ('cod_discount_pct', 'min_order_amount', 'first_500_promo', 'feature_flags', 'business_profile', 'cutoff_time', 'delivery_cutoff_time', 'delivery_zones') THEN
        IF v_admin_role <> 'owner' THEN
            RAISE EXCEPTION 'Unauthorized: Only Owner can modify %', p_key;
        END IF;
    END IF;

    SELECT value INTO v_old_value FROM app_settings WHERE key = p_key;

    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (p_key, p_value, p_admin_id, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

    -- Audit Log
    INSERT INTO audit_logs (actor_user_id, actor_role, action, table_name, record_id, old_data, new_data)
    VALUES (
        p_admin_id,
        v_admin_role,
        'SETTING_UPDATED',
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

REVOKE ALL ON FUNCTION update_business_setting(UUID, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_business_setting(UUID, VARCHAR, JSONB) TO authenticated, service_role;

-- 4. RLS Hardening for Audit Logs & Settings
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_owner_read ON audit_logs;
CREATE POLICY audit_logs_owner_read ON audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN user_profiles up ON ur.user_id = up.id
            WHERE up.id = auth.uid()
              AND ur.role = 'owner'
        )
    );

COMMIT;
