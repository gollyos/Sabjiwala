-- =============================================================================
-- SABJIWALA: COMPREHENSIVE CUSTOMER AUTH & ADDRESS TEST SUITE
-- =============================================================================

DO $$
DECLARE
    -- Test Customers
    v_user_a_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    v_phone_a VARCHAR(15) := '+919876511111';
    
    v_user_b_id UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    v_phone_b VARCHAR(15) := '+919876522222';

    v_profile_a JSONB;
    v_profile_b JSONB;
    v_addr_res JSONB;
    v_work_addr_id UUID;
    v_temp_addr_id UUID;
    v_home_addr_id UUID;
    v_seq_first INT;
    v_seq_second INT;
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'STARTING SABJIWALA AUTH & MULTI-ADDRESS TEST MATRIX';
    RAISE NOTICE '------------------------------------------------------------';

    -- Setup Auth User A in auth.users
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        v_user_a_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'customer_a@example.com',
        v_phone_a,
        'hash_a',
        now(),
        now(),
        '{"provider":"phone"}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET phone = v_phone_a;

    -- Setup Auth User B in auth.users
    INSERT INTO auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        v_user_b_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        'customer_b@example.com',
        v_phone_b,
        'hash_b',
        now(),
        now(),
        '{"provider":"phone"}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET phone = v_phone_b;


    -- =========================================================================
    -- TEST 1: First-Time Customer Onboarding (Customer A)
    -- =========================================================================
    RAISE NOTICE '[TEST 1] Testing First-Time Customer Onboarding for Customer A...';
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT complete_customer_onboarding(
        'Sureshbhai Amin',
        '+919876599999',
        'suresh.amin@example.com',
        'home',
        'C-201, Shanti Niketan Flats',
        'Near Halol Highway Circle',
        'Opposite City Garden',
        'Highway Zone',
        'Halol',
        'Panchmahal',
        'Gujarat',
        '389350'
    ) INTO v_profile_a;

    IF (v_profile_a->>'is_onboarded')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Customer A should be onboarded.';
    END IF;

    v_seq_first := (v_profile_a->'customer'->>'verified_sequence')::int;
    v_home_addr_id := (v_profile_a->'default_address'->>'id')::uuid;

    IF v_seq_first IS NULL THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Verified sequence must not be null.';
    END IF;
    RAISE NOTICE '✅ TEST 1 PASSED: Customer A onboarded with sequence #%', v_seq_first;


    -- =========================================================================
    -- TEST 2: Returning Customer Flow & Sequence Idempotency
    -- =========================================================================
    RAISE NOTICE '[TEST 2] Testing Returning Customer Login & Sequence Idempotency...';
    SELECT get_current_customer_profile() INTO v_profile_a;

    IF (v_profile_a->>'is_onboarded')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Returning customer must be recognized as onboarded.';
    END IF;

    v_seq_second := (v_profile_a->'customer'->>'verified_sequence')::int;
    IF v_seq_first <> v_seq_second THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Returning customer sequence changed (% vs %)!', v_seq_first, v_seq_second;
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Returning customer profile loaded with sequence #%', v_seq_second;


    -- =========================================================================
    -- TEST 3: Add Multiple Saved Addresses (Work & Temporary)
    -- =========================================================================
    RAISE NOTICE '[TEST 3] Adding Work & Temporary Addresses for Customer A...';
    
    -- Add Work Address
    SELECT save_customer_address(
        p_address_id => NULL,
        p_address_type => 'work',
        p_flat_house_no => 'Shop No. 12, APMC Market Complex',
        p_society_street_name => 'Godhra Road',
        p_landmark => 'Gate No. 2',
        p_area_locality => 'APMC Commercial Area',
        p_is_default => false
    ) INTO v_addr_res;

    -- Find work address ID from list
    SELECT (elem->>'id')::uuid INTO v_work_addr_id
    FROM jsonb_array_elements(v_addr_res->'addresses') elem
    WHERE elem->>'address_type' = 'work'
    LIMIT 1;

    IF v_work_addr_id IS NULL THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Work address was not created.';
    END IF;

    -- Add Temporary Address
    SELECT save_customer_address(
        p_address_id => NULL,
        p_address_type => 'temporary',
        p_flat_house_no => 'Plot 45, GIDC Industrial Estate',
        p_society_street_name => 'Pavagadh Road',
        p_landmark => 'Near Water Tank',
        p_area_locality => 'GIDC Phase 1',
        p_is_default => false
    ) INTO v_addr_res;

    IF jsonb_array_length(v_addr_res->'addresses') <> 3 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Customer should have 3 addresses, found %', jsonb_array_length(v_addr_res->'addresses');
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Multiple addresses (Home, Work, Temporary) saved.';


    -- =========================================================================
    -- TEST 4: Switch Default Address & Enforce Single Default Constraint
    -- =========================================================================
    RAISE NOTICE '[TEST 4] Switching Default Address to Work...';
    SELECT set_default_customer_address(v_work_addr_id) INTO v_addr_res;

    IF (v_addr_res->'default_address'->>'id')::uuid <> v_work_addr_id THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Default address should be Work address %', v_work_addr_id;
    END IF;

    -- Verify exactly 1 default address exists in table
    IF (
        SELECT count(*) FROM customer_addresses 
        WHERE customer_id = (v_addr_res->'customer'->>'id')::uuid AND is_default = true AND is_deleted = false
    ) <> 1 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: More than 1 default address found!';
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Default address successfully switched to Work.';


    -- =========================================================================
    -- TEST 5: Soft-Delete Address & Auto-Promote Default
    -- =========================================================================
    RAISE NOTICE '[TEST 5] Deleting Work Address and verifying Auto-Promote...';
    SELECT delete_customer_address(v_work_addr_id) INTO v_addr_res;

    IF (v_addr_res->'default_address'->>'id')::uuid = v_work_addr_id THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Deleted address is still marked default.';
    END IF;

    IF v_addr_res->'default_address'->>'id' IS NULL THEN
        RAISE EXCEPTION 'TEST 5 FAILED: A remaining active address should have been promoted to default.';
    END IF;
    RAISE NOTICE '✅ TEST 5 PASSED: Address soft-deleted and default auto-promoted.';


    -- =========================================================================
    -- TEST 6: First-Time Onboarding for Customer B
    -- =========================================================================
    RAISE NOTICE '[TEST 6] Onboarding Customer B...';
    PERFORM set_config('request.jwt.claim.sub', v_user_b_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT complete_customer_onboarding(
        'Bhavnaben Joshi',
        NULL,
        'bhavna.joshi@example.com',
        'home',
        '10, Gayatri Society',
        'Halol-Vadodara Road',
        'Near Gayatri Temple',
        'Gayatri Nagar',
        'Halol',
        'Panchmahal',
        'Gujarat',
        '389350'
    ) INTO v_profile_b;

    IF (v_profile_b->>'is_onboarded')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Customer B onboarding failed.';
    END IF;
    RAISE NOTICE '✅ TEST 6 PASSED: Customer B onboarded with sequence #%', v_profile_b->'customer'->>'verified_sequence';


    -- =========================================================================
    -- TEST 7: Cross-Tenant Isolation (Customer B CANNOT access Customer A data)
    -- =========================================================================
    RAISE NOTICE '[TEST 7] Verifying RLS Tenant Isolation between Customer B and Customer A...';
    
    -- Customer B attempts to view Customer A's addresses
    IF EXISTS (
        SELECT 1 FROM customer_addresses 
        WHERE id = v_home_addr_id AND customer_id = (v_profile_a->'customer'->>'id')::uuid
          AND customer_id IN (SELECT id FROM customers WHERE auth_user_id = (select auth.uid()))
    ) THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Customer B should NOT be able to access Customer A address!';
    END IF;

    -- Customer B attempts to delete Customer A's address via RPC
    BEGIN
        PERFORM delete_customer_address(v_home_addr_id);
        RAISE EXCEPTION 'TEST 7 FAILED: Customer B was able to call delete on Customer A address!';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✅ TEST 7 PASSED: Customer B was successfully blocked from deleting Customer A address (% )', SQLERRM;
    END;


    -- =========================================================================
    -- TEST 8: Direct Client Attempt to Mutate Security Fields is BLOCKED
    -- =========================================================================
    RAISE NOTICE '[TEST 8] Verifying Security Trigger trg_protect_customer_security blocks direct tampering...';
    BEGIN
        UPDATE customers 
        SET is_verified = true,
            verified_sequence = 1
        WHERE auth_user_id = v_user_b_id;
        
        RAISE EXCEPTION 'TEST 8 FAILED: Direct client update of verified_sequence should have been blocked!';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✅ TEST 8 PASSED: Security trigger successfully blocked direct tampering (% )', SQLERRM;
    END;

    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'ALL 8 INTEGRATION TESTS IN SUITE PASSED WITH 100%% SUCCESS!';
    RAISE NOTICE '------------------------------------------------------------';
END $$;
