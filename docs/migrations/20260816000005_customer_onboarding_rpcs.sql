-- =============================================================================
-- CUSTOMER AUTH, ONBOARDING & PROFILE MANAGEMENT RPCS
-- =============================================================================

BEGIN;

-- 1. Get Current Authenticated Customer & Default Address
CREATE OR REPLACE FUNCTION get_current_customer_profile()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_auth_phone TEXT;
    v_customer RECORD;
    v_default_address RECORD;
    v_addresses JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('authenticated', false);
    END IF;

    -- Extract phone from auth.users
    SELECT phone INTO v_auth_phone 
    FROM auth.users 
    WHERE id = v_user_id;

    -- Look up customer by auth_user_id or by mobile
    SELECT * INTO v_customer 
    FROM customers 
    WHERE auth_user_id = v_user_id 
       OR (mobile = v_auth_phone AND auth_user_id IS NULL);

    -- If found by phone but auth_user_id wasn't linked yet, link it
    IF v_customer.id IS NOT NULL AND v_customer.auth_user_id IS NULL THEN
        UPDATE customers 
        SET auth_user_id = v_user_id,
            updated_at = now()
        WHERE id = v_customer.id;
        
        SELECT * INTO v_customer FROM customers WHERE id = v_customer.id;
    END IF;

    IF v_customer.id IS NULL THEN
        RETURN jsonb_build_object(
            'authenticated', true,
            'is_onboarded', false,
            'mobile', v_auth_phone
        );
    END IF;

    -- If not yet verified, verify now
    IF NOT v_customer.is_verified THEN
        PERFORM verify_customer_phone(v_customer.id);
        SELECT * INTO v_customer FROM customers WHERE id = v_customer.id;
    END IF;

    -- Fetch default address
    SELECT * INTO v_default_address 
    FROM customer_addresses 
    WHERE customer_id = v_customer.id 
      AND is_default = true 
      AND is_deleted = false 
    LIMIT 1;

    -- If no default address set, grab first non-deleted address
    IF v_default_address.id IS NULL THEN
        SELECT * INTO v_default_address 
        FROM customer_addresses 
        WHERE customer_id = v_customer.id 
          AND is_deleted = false 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    -- Fetch all active addresses
    SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_addresses
    FROM customer_addresses a
    WHERE a.customer_id = v_customer.id AND a.is_deleted = false;

    RETURN jsonb_build_object(
        'authenticated', true,
        'is_onboarded', (v_customer.full_name IS NOT NULL AND v_customer.full_name <> '' AND v_default_address.id IS NOT NULL),
        'customer', to_jsonb(v_customer),
        'default_address', CASE WHEN v_default_address.id IS NOT NULL THEN to_jsonb(v_default_address) ELSE NULL END,
        'addresses', v_addresses
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_current_customer_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_current_customer_profile() TO authenticated;


-- 2. Complete First-Time Customer Onboarding RPC
CREATE OR REPLACE FUNCTION complete_customer_onboarding(
    p_full_name TEXT,
    p_alternate_mobile VARCHAR(15) DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_address_type VARCHAR(20) DEFAULT 'home',
    p_flat_house_no TEXT DEFAULT '',
    p_society_street_name TEXT DEFAULT '',
    p_landmark TEXT DEFAULT '',
    p_area_locality TEXT DEFAULT '',
    p_city TEXT DEFAULT 'Halol',
    p_district TEXT DEFAULT 'Panchmahal',
    p_state TEXT DEFAULT 'Gujarat',
    p_pincode VARCHAR(10) DEFAULT '389350',
    p_latitude NUMERIC(10, 7) DEFAULT NULL,
    p_longitude NUMERIC(10, 7) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_auth_phone TEXT;
    v_customer_id UUID;
    v_address_id UUID;
    v_seq INT;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF TRIM(COALESCE(p_full_name, '')) = '' THEN
        RAISE EXCEPTION 'Full name is required.';
    END IF;

    IF TRIM(COALESCE(p_flat_house_no, '')) = '' OR 
       TRIM(COALESCE(p_society_street_name, '')) = '' OR 
       TRIM(COALESCE(p_landmark, '')) = '' OR 
       TRIM(COALESCE(p_area_locality, '')) = '' THEN
        RAISE EXCEPTION 'Complete delivery address with house number, street/society, landmark and area is required.';
    END IF;

    -- Extract phone from auth.users
    SELECT phone INTO v_auth_phone 
    FROM auth.users 
    WHERE id = v_user_id;

    IF v_auth_phone IS NULL OR v_auth_phone = '' THEN
        RAISE EXCEPTION 'Phone number missing in authenticated user session.';
    END IF;

    -- Insert or Update customer record
    INSERT INTO customers (
        auth_user_id,
        mobile,
        full_name,
        alternate_mobile,
        email,
        is_verified,
        verified_at,
        is_active
    ) VALUES (
        v_user_id,
        v_auth_phone,
        TRIM(p_full_name),
        p_alternate_mobile,
        p_email,
        true,
        now(),
        true
    )
    ON CONFLICT (mobile) DO UPDATE SET
        auth_user_id = v_user_id,
        full_name = EXCLUDED.full_name,
        alternate_mobile = COALESCE(EXCLUDED.alternate_mobile, customers.alternate_mobile),
        email = COALESCE(EXCLUDED.email, customers.email),
        updated_at = now()
    RETURNING id INTO v_customer_id;

    -- Verify and assign sequence
    v_seq := verify_customer_phone(v_customer_id);

    -- Unset previous default addresses if any
    UPDATE customer_addresses 
    SET is_default = false 
    WHERE customer_id = v_customer_id;

    -- Insert initial default delivery address
    INSERT INTO customer_addresses (
        customer_id,
        address_type,
        flat_house_no,
        society_street_name,
        landmark,
        area_locality,
        city,
        district,
        state,
        pincode,
        latitude,
        longitude,
        is_default,
        is_deleted
    ) VALUES (
        v_customer_id,
        COALESCE(p_address_type, 'home'),
        TRIM(p_flat_house_no),
        TRIM(p_society_street_name),
        TRIM(p_landmark),
        TRIM(p_area_locality),
        COALESCE(p_city, 'Halol'),
        COALESCE(p_district, 'Panchmahal'),
        COALESCE(p_state, 'Gujarat'),
        COALESCE(p_pincode, '389350'),
        p_latitude,
        p_longitude,
        true,
        false
    ) RETURNING id INTO v_address_id;

    -- Return full profile
    SELECT get_current_customer_profile() INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION complete_customer_onboarding(TEXT, VARCHAR, TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, VARCHAR, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_customer_onboarding(TEXT, VARCHAR, TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, VARCHAR, NUMERIC, NUMERIC) TO authenticated;


-- 3. Set Default Address RPC
CREATE OR REPLACE FUNCTION set_default_customer_address(p_address_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer RECORD;
BEGIN
    SELECT * INTO v_customer 
    FROM customers 
    WHERE auth_user_id = v_user_id;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'Customer not found.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM customer_addresses 
        WHERE id = p_address_id AND customer_id = v_customer.id AND is_deleted = false
    ) THEN
        RAISE EXCEPTION 'Address not found.';
    END IF;

    UPDATE customer_addresses 
    SET is_default = false 
    WHERE customer_id = v_customer.id;

    UPDATE customer_addresses 
    SET is_default = true, updated_at = now() 
    WHERE id = p_address_id AND customer_id = v_customer.id;

    RETURN get_current_customer_profile();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION set_default_customer_address(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_default_customer_address(UUID) TO authenticated;

COMMIT;
