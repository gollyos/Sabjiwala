-- =============================================================================
-- MIGRATION: REMOVE BAG-SCAN VERIFICATION REQUIREMENT FROM PACKING COMPLETION
-- Date: 2026-08-23
-- Context: The bag-scan verification UI (driver app "Scan Bag" step, and the
-- staff bag-scanning flow) has been removed for now — no barcode scanner
-- hardware/labels are being purchased at this stage. But
-- mark_order_ready_for_delivery() still hard-blocked packing completion with
-- "X of Y bags have not been scanned & verified", and nothing in the app can
-- ever set packing_bags.is_verified = true anymore, so packing could never be
-- completed. This drops that blocking check; item-pack confirmation is still
-- required, and packing_bags rows / bag counts continue to work exactly as
-- before for printing stickers etc. — only the scan-verification gate is gone.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION mark_order_ready_for_delivery(
    p_order_id UUID,
    p_staff_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_unconfirmed_items INT;
    v_total_bags INT;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    IF v_order.order_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_CANCELLED', 'message', 'Cannot pack a cancelled order.');
    END IF;

    IF v_order.packing_status = 'problem' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNRESOLVED_PACKING_PROBLEM', 'message', 'Cannot mark ready while a packing problem is unresolved.');
    END IF;

    -- Verification check 1: All items confirmed
    SELECT COUNT(*) INTO v_unconfirmed_items
    FROM order_items
    WHERE order_id = p_order_id AND is_packed_confirmed = false;

    IF v_unconfirmed_items > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNCONFIRMED_ITEMS_REMAINING',
            'unconfirmed_count', v_unconfirmed_items,
            'message', format('%s item(s) have not been confirmed packed.', v_unconfirmed_items)
        );
    END IF;

    SELECT COUNT(*) INTO v_total_bags FROM packing_bags WHERE order_id = p_order_id;

    -- Transition to Packed / Verified Ready
    UPDATE orders
    SET
        order_status = 'packed'::order_status_type,
        packing_status = 'verified',
        packed_at = COALESCE(packed_at, v_now),
        packing_verified_at = v_now,
        updated_at = v_now
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        actor_user_id,
        actor_role
    ) VALUES (
        'orders',
        p_order_id::text,
        'UPDATE',
        jsonb_build_object(
            'event', 'ORDER_PACKED_AND_READY',
            'order_number', v_order.order_number,
            'total_bags', v_total_bags
        ),
        p_staff_user_id,
        'packing'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order.order_number,
        'order_status', 'packed',
        'packing_status', 'verified',
        'total_bags', v_total_bags
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION mark_order_ready_for_delivery(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_order_ready_for_delivery(UUID, UUID) TO authenticated, service_role;

COMMIT;
