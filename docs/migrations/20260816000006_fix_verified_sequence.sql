-- =============================================================================
-- FIX VERIFIED SEQUENCE ASSIGNMENT IN ONBOARDING & VERIFY FUNCTION
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION verify_customer_phone(p_customer_id UUID)
RETURNS INT AS $$
DECLARE
    v_cust RECORD;
    v_seq INT;
BEGIN
    SELECT is_verified, verified_sequence INTO v_cust
    FROM customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer % not found.', p_customer_id;
    END IF;

    -- If already verified AND has a sequence assigned, return it
    IF v_cust.is_verified AND v_cust.verified_sequence IS NOT NULL THEN
        RETURN v_cust.verified_sequence;
    END IF;

    -- Allocate sequence
    SELECT nextval('customer_verified_sequence') INTO v_seq;

    UPDATE customers
    SET is_verified = true,
        verified_at = COALESCE(verified_at, now()),
        verified_sequence = v_seq,
        updated_at = now()
    WHERE id = p_customer_id;

    RETURN v_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

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

    SELECT phone INTO v_auth_phone 
    FROM auth.users 
    WHERE id = v_user_id;

    IF v_auth_phone IS NULL OR v_auth_phone = '' THEN
        RAISE EXCEPTION 'Phone number missing in authenticated user session.';
    END IF;

    -- Insert customer record (is_verified will be set by verify_customer_phone)
    INSERT INTO customers (
        auth_user_id,
        mobile,
        full_name,
        alternate_mobile,
        email,
        is_verified,
        is_active
    ) VALUES (
        v_user_id,
        v_auth_phone,
        TRIM(p_full_name),
        p_alternate_mobile,
        p_email,
        false,
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

    SELECT get_current_customer_profile() INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

COMMIT;
