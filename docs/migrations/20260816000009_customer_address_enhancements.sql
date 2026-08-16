-- =============================================================================
-- CUSTOMER PROFILE & MULTI-ADDRESS MANAGEMENT ENHANCEMENTS
-- =============================================================================

BEGIN;

-- 1. Default Landmark to empty string if not provided
ALTER TABLE customer_addresses ALTER COLUMN landmark SET DEFAULT '';

-- 2. Enhanced Address CRUD RPCs
CREATE OR REPLACE FUNCTION save_customer_address(
    p_address_id UUID DEFAULT NULL,
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
    p_longitude NUMERIC(10, 7) DEFAULT NULL,
    p_is_default BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer RECORD;
    v_target_address_id UUID := p_address_id;
    v_existing_address RECORD;
    v_has_other_addresses BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_customer 
    FROM customers 
    WHERE auth_user_id = v_user_id;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'Customer profile not found.';
    END IF;

    IF TRIM(COALESCE(p_flat_house_no, '')) = '' OR 
       TRIM(COALESCE(p_society_street_name, '')) = '' OR 
       TRIM(COALESCE(p_area_locality, '')) = '' THEN
        RAISE EXCEPTION 'House/Flat No, Society/Street name, and Area/Locality in Halol are required.';
    END IF;

    -- Check if this is the customer's first active address
    SELECT EXISTS (
        SELECT 1 FROM customer_addresses 
        WHERE customer_id = v_customer.id AND is_deleted = false AND (p_address_id IS NULL OR id <> p_address_id)
    ) INTO v_has_other_addresses;

    -- If no other addresses exist, force is_default to true
    IF NOT v_has_other_addresses THEN
        p_is_default := true;
    END IF;

    -- If setting as default, unmark other default addresses first
    IF p_is_default THEN
        UPDATE customer_addresses 
        SET is_default = false 
        WHERE customer_id = v_customer.id;
    END IF;

    IF v_target_address_id IS NOT NULL THEN
        -- UPDATE existing address
        SELECT * INTO v_existing_address 
        FROM customer_addresses 
        WHERE id = v_target_address_id AND customer_id = v_customer.id AND is_deleted = false;

        IF v_existing_address.id IS NULL THEN
            RAISE EXCEPTION 'Address not found or unauthorized.';
        END IF;

        UPDATE customer_addresses 
        SET address_type = COALESCE(p_address_type, address_type),
            flat_house_no = TRIM(p_flat_house_no),
            society_street_name = TRIM(p_society_street_name),
            landmark = TRIM(COALESCE(p_landmark, '')),
            area_locality = TRIM(p_area_locality),
            city = COALESCE(p_city, city),
            district = COALESCE(p_district, district),
            state = COALESCE(p_state, state),
            pincode = COALESCE(p_pincode, pincode),
            latitude = COALESCE(p_latitude, latitude),
            longitude = COALESCE(p_longitude, longitude),
            is_default = p_is_default,
            updated_at = now()
        WHERE id = v_target_address_id;
    ELSE
        -- INSERT new address
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
            v_customer.id,
            COALESCE(p_address_type, 'home'),
            TRIM(p_flat_house_no),
            TRIM(p_society_street_name),
            TRIM(COALESCE(p_landmark, '')),
            TRIM(p_area_locality),
            COALESCE(p_city, 'Halol'),
            COALESCE(p_district, 'Panchmahal'),
            COALESCE(p_state, 'Gujarat'),
            COALESCE(p_pincode, '389350'),
            p_latitude,
            p_longitude,
            p_is_default,
            false
        ) RETURNING id INTO v_target_address_id;
    END IF;

    RETURN get_current_customer_profile();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION save_customer_address(UUID, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, VARCHAR, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_customer_address(UUID, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, VARCHAR, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;


-- 3. Delete (Soft-Delete) Customer Address RPC
CREATE OR REPLACE FUNCTION delete_customer_address(p_address_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer RECORD;
    v_target_address RECORD;
    v_new_default_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_customer 
    FROM customers 
    WHERE auth_user_id = v_user_id;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'Customer profile not found.';
    END IF;

    SELECT * INTO v_target_address 
    FROM customer_addresses 
    WHERE id = p_address_id AND customer_id = v_customer.id AND is_deleted = false;

    IF v_target_address.id IS NULL THEN
        RAISE EXCEPTION 'Address not found or already deleted.';
    END IF;

    -- Soft delete
    UPDATE customer_addresses 
    SET is_deleted = true,
        is_default = false,
        updated_at = now()
    WHERE id = p_address_id;

    -- If this was the default address, promote another active address to default
    IF v_target_address.is_default THEN
        SELECT id INTO v_new_default_id 
        FROM customer_addresses 
        WHERE customer_id = v_customer.id AND is_deleted = false 
        ORDER BY created_at DESC 
        LIMIT 1;

        IF v_new_default_id IS NOT NULL THEN
            UPDATE customer_addresses 
            SET is_default = true, updated_at = now() 
            WHERE id = v_new_default_id;
        END IF;
    END IF;

    RETURN get_current_customer_profile();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION delete_customer_address(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_customer_address(UUID) TO authenticated;


-- 4. Update Safe Customer Profile Info (Name, Alternate Phone, Email)
CREATE OR REPLACE FUNCTION update_customer_profile_info(
    p_full_name TEXT,
    p_alternate_mobile VARCHAR(15) DEFAULT NULL,
    p_email TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_customer RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF TRIM(COALESCE(p_full_name, '')) = '' THEN
        RAISE EXCEPTION 'Full name is required.';
    END IF;

    SELECT * INTO v_customer 
    FROM customers 
    WHERE auth_user_id = v_user_id;

    IF v_customer.id IS NULL THEN
        RAISE EXCEPTION 'Customer profile not found.';
    END IF;

    UPDATE customers 
    SET full_name = TRIM(p_full_name),
        alternate_mobile = TRIM(p_alternate_mobile),
        email = TRIM(p_email),
        updated_at = now()
    WHERE id = v_customer.id;

    RETURN get_current_customer_profile();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION update_customer_profile_info(TEXT, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_customer_profile_info(TEXT, VARCHAR, TEXT) TO authenticated;

COMMIT;
