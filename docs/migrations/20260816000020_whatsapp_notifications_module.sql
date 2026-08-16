-- =============================================================================
-- SABJIWALA: WHATSAPP BUSINESS & NOTIFICATION AUTOMATION MODULE
-- =============================================================================

BEGIN;

-- 1. Add tracking_token to orders table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tracking_token'
    ) THEN
        ALTER TABLE orders ADD COLUMN tracking_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');
    END IF;
END $$;

-- Populate tracking_token for existing orders if any are null
UPDATE orders 
SET tracking_token = encode(gen_random_bytes(16), 'hex') 
WHERE tracking_token IS NULL;

-- 2. Create notification_jobs Table (Transactional Outbox)
CREATE TABLE IF NOT EXISTS notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    notification_type VARCHAR(64) NOT NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
    recipient VARCHAR(32) NOT NULL, -- Normalized E.164 (+91XXXXXXXXXX)
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES procurement_batches(id) ON DELETE CASCADE,
    template_key VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'cancelled')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_error TEXT,
    whatsapp_message_id VARCHAR(128),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes for Notification Outbox
CREATE INDEX IF NOT EXISTS idx_notification_jobs_status_sched ON notification_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_type ON notification_jobs(notification_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_recipient ON notification_jobs(recipient, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_order ON notification_jobs(order_id);

-- Enable RLS on notification_jobs
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_jobs_admin_all ON notification_jobs;
CREATE POLICY notification_jobs_admin_all ON notification_jobs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN user_profiles up ON ur.user_id = up.id
            WHERE up.id = auth.uid()
              AND ur.role IN ('owner', 'manager')
        )
    );

-- 3. Utility: normalize_e164_indian_mobile
CREATE OR REPLACE FUNCTION normalize_e164_indian_mobile(p_mobile TEXT)
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Function: enqueue_notification_job (Idempotent & Resilient)
CREATE OR REPLACE FUNCTION enqueue_notification_job(
    p_idempotency_key VARCHAR,
    p_notification_type VARCHAR,
    p_recipient VARCHAR,
    p_template_key VARCHAR,
    p_payload JSONB,
    p_customer_id UUID DEFAULT NULL,
    p_order_id UUID DEFAULT NULL,
    p_batch_id UUID DEFAULT NULL,
    p_channel VARCHAR DEFAULT 'whatsapp'
)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_norm_recipient TEXT;
BEGIN
    v_norm_recipient := normalize_e164_indian_mobile(p_recipient);
    IF v_norm_recipient IS NULL THEN
        RAISE WARNING 'Cannot enqueue notification: invalid recipient mobile %', p_recipient;
        RETURN NULL;
    END IF;

    INSERT INTO notification_jobs (
        idempotency_key,
        notification_type,
        channel,
        recipient,
        customer_id,
        order_id,
        batch_id,
        template_key,
        payload,
        status
    )
    VALUES (
        p_idempotency_key,
        p_notification_type,
        p_channel,
        v_norm_recipient,
        p_customer_id,
        p_order_id,
        p_batch_id,
        p_template_key,
        p_payload,
        'queued'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
EXCEPTION WHEN OTHERS THEN
    -- Resilient exception handling: Never let notification failure break core business transactions
    RAISE WARNING 'enqueue_notification_job exception: % (SQLSTATE %)', SQLERRM, SQLSTATE;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 5. Helper Function: format_order_whatsapp_payload
CREATE OR REPLACE FUNCTION format_order_whatsapp_payload(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_items JSONB := '[]'::jsonb;
    v_item RECORD;
    v_count INT := 0;
BEGIN
    SELECT 
        o.id,
        o.order_number,
        o.customer_id,
        o.customer_name_snapshot,
        o.customer_mobile_snapshot,
        o.delivery_date,
        to_char(o.delivery_date, 'DD Mon YYYY') AS formatted_delivery_date,
        to_char(o.delivery_date, 'Dy, DD Mon') AS short_delivery_date,
        o.delivery_slot_start,
        o.delivery_slot_end,
        o.subtotal_amount,
        o.first_order_discount,
        o.cod_discount,
        o.final_payable_amount,
        o.order_status,
        o.payment_method,
        o.delivery_area_snapshot,
        o.tracking_token
    INTO v_order
    FROM orders o
    WHERE o.id = p_order_id;

    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;

    -- Collect first 4 line items + count remaining
    FOR v_item IN
        SELECT 
            oi.product_name_en_snapshot AS name_en,
            oi.product_name_gu_snapshot AS name_gu,
            oi.variant_name_en_snapshot AS variant_en,
            oi.quantity,
            oi.unit_code_snapshot AS unit,
            oi.selling_price_snapshot AS price,
            oi.line_total AS total
        FROM order_items oi
        WHERE oi.order_id = p_order_id
        ORDER BY oi.created_at ASC
    LOOP
        v_count := v_count + 1;
        IF v_count <= 4 THEN
            v_items := v_items || jsonb_build_object(
                'name_en', v_item.name_en,
                'name_gu', v_item.name_gu,
                'variant', v_item.variant_en,
                'qty', v_item.quantity,
                'unit', v_item.unit,
                'price', v_item.price,
                'total', v_item.total
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'customer_name', v_order.customer_name_snapshot,
        'customer_mobile', v_order.customer_mobile_snapshot,
        'delivery_date', v_order.formatted_delivery_date,
        'short_delivery_date', v_order.short_delivery_date,
        'delivery_slot', '10:00 AM - 1:00 PM',
        'subtotal', v_order.subtotal_amount,
        'first500_discount', v_order.first_order_discount,
        'cod_discount', v_order.cod_discount,
        'total_discounts', (v_order.first_order_discount + v_order.cod_discount),
        'final_amount', v_order.final_payable_amount,
        'delivery_area', v_order.delivery_area_snapshot,
        'tracking_token', v_order.tracking_token,
        'items_sample', v_items,
        'total_items_count', v_count,
        'more_items_count', GREATEST(0, v_count - 4)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 6. Helper Function: format_procurement_batch_whatsapp_payload
CREATE OR REPLACE FUNCTION format_procurement_batch_whatsapp_payload(p_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_items JSONB := '[]'::jsonb;
    v_item RECORD;
    v_count INT := 0;
    v_total_orders INT := 0;
    v_total_cod NUMERIC := 0.00;
BEGIN
    SELECT 
        pb.id,
        pb.batch_number,
        pb.batch_date,
        to_char(pb.batch_date, 'DD Mon YYYY') AS formatted_batch_date,
        pb.status,
        pb.cutoff_timestamp,
        pb.total_procurement_cost
    INTO v_batch
    FROM procurement_batches pb
    WHERE pb.id = p_batch_id;

    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;

    -- Aggregate orders linked to batch
    SELECT 
        COUNT(DISTINCT o.id),
        COALESCE(SUM(o.final_payable_amount), 0.00)
    INTO v_total_orders, v_total_cod
    FROM procurement_batch_orders pbo
    JOIN orders o ON pbo.order_id = o.id
    WHERE pbo.batch_id = p_batch_id;

    -- Collect items requirement
    FOR v_item IN
        SELECT 
            p.name_en,
            p.name_gu,
            pu.code AS unit,
            pi.suggested_procurement_qty AS required_qty
        FROM procurement_items pi
        JOIN products p ON pi.product_id = p.id
        JOIN product_units pu ON pi.base_unit_id = pu.id
        WHERE pi.batch_id = p_batch_id
        ORDER BY pi.suggested_procurement_qty DESC
    LOOP
        v_count := v_count + 1;
        IF v_count <= 8 THEN
            v_items := v_items || jsonb_build_object(
                'name_en', v_item.name_en,
                'name_gu', v_item.name_gu,
                'unit', v_item.unit,
                'qty', v_item.required_qty
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'batch_id', v_batch.id,
        'batch_number', v_batch.batch_number,
        'delivery_date', v_batch.formatted_batch_date,
        'total_orders', v_total_orders,
        'expected_cod', v_total_cod,
        'total_products_count', v_count,
        'items_sample', v_items,
        'more_products_count', GREATEST(0, v_count - 8)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 7. Trigger: Auto-enqueue ORDER_CONFIRMED on Orders Creation
CREATE OR REPLACE FUNCTION trg_order_confirmed_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_owner_mobile TEXT;
    v_owner_settings JSONB;
BEGIN
    -- Only enqueue for confirmed / active orders
    IF (TG_OP = 'INSERT' AND NEW.order_status = 'confirmed') 
       OR (TG_OP = 'UPDATE' AND OLD.order_status <> 'confirmed' AND NEW.order_status = 'confirmed') THEN
        
        v_payload := format_order_whatsapp_payload(NEW.id);

        -- Enqueue Customer Order Confirmation
        PERFORM enqueue_notification_job(
            'ORDER_CONFIRMED:' || NEW.id::text,
            'ORDER_CONFIRMED',
            NEW.customer_mobile_snapshot,
            'customer_order_confirmed',
            v_payload,
            NEW.customer_id,
            NEW.id,
            NULL,
            'whatsapp'
        );
    END IF;

    -- Packing Problem Alert to Owner
    IF (TG_OP = 'UPDATE' AND OLD.packing_status <> 'problem' AND NEW.packing_status = 'problem') THEN
        -- Get Owner Mobile from app_settings
        SELECT (value->>'owner_mobile') INTO v_owner_mobile
        FROM app_settings WHERE key = 'whatsapp_config';

        IF v_owner_mobile IS NOT NULL THEN
            PERFORM enqueue_notification_job(
                'PACKING_PROBLEM:' || NEW.id::text || ':' || now()::text,
                'PACKING_PROBLEM',
                v_owner_mobile,
                'owner_packing_problem',
                jsonb_build_object(
                    'order_id', NEW.id,
                    'order_number', NEW.order_number,
                    'customer_name', NEW.customer_name_snapshot,
                    'customer_mobile', NEW.customer_mobile_snapshot,
                    'area', NEW.delivery_area_snapshot,
                    'issue', COALESCE(NEW.packing_problem_notes, 'Packing exception reported in godown')
                ),
                NEW.customer_id,
                NEW.id,
                NULL,
                'whatsapp'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_orders_notifications ON orders;
CREATE TRIGGER trg_orders_notifications
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trg_order_confirmed_notification();

-- 8. Trigger: Auto-enqueue 8 PM Owner Summary on Procurement Batch Lock
CREATE OR REPLACE FUNCTION trg_procurement_batch_locked_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_owner_mobile TEXT;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status <> 'locked' AND NEW.status = 'locked') THEN
        -- Fetch Owner Mobile
        SELECT (value->>'owner_mobile') INTO v_owner_mobile
        FROM app_settings WHERE key = 'whatsapp_config';

        IF v_owner_mobile IS NOT NULL THEN
            v_payload := format_procurement_batch_whatsapp_payload(NEW.id);

            PERFORM enqueue_notification_job(
                'PROCUREMENT_BATCH_LOCKED:' || NEW.id::text,
                'PROCUREMENT_BATCH_LOCKED',
                v_owner_mobile,
                'owner_procurement_report',
                v_payload,
                NULL,
                NULL,
                NEW.id,
                'whatsapp'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_procurement_batch_notifications ON procurement_batches;
CREATE TRIGGER trg_procurement_batch_notifications
    AFTER UPDATE ON procurement_batches
    FOR EACH ROW
    EXECUTE FUNCTION trg_procurement_batch_locked_notification();

-- 9. Trigger: Auto-enqueue Out for Delivery / Delivered / Failed on Deliveries
CREATE OR REPLACE FUNCTION trg_delivery_status_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_payload JSONB;
    v_owner_mobile TEXT;
BEGIN
    SELECT 
        o.id,
        o.order_number,
        o.customer_id,
        o.customer_name_snapshot,
        o.customer_mobile_snapshot,
        o.final_payable_amount,
        o.delivery_area_snapshot,
        o.tracking_token
    INTO v_order
    FROM orders o
    WHERE o.id = NEW.order_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- A. OUT_FOR_DELIVERY
    IF (TG_OP = 'UPDATE' AND OLD.status <> 'out_for_delivery' AND NEW.status = 'out_for_delivery') THEN
        PERFORM enqueue_notification_job(
            'OUT_FOR_DELIVERY:' || NEW.order_id::text,
            'OUT_FOR_DELIVERY',
            v_order.customer_mobile_snapshot,
            'customer_out_for_delivery',
            jsonb_build_object(
                'order_number', v_order.order_number,
                'customer_name', v_order.customer_name_snapshot,
                'final_amount', v_order.final_payable_amount,
                'delivery_slot', '10:00 AM - 1:00 PM',
                'tracking_token', v_order.tracking_token
            ),
            v_order.customer_id,
            v_order.id,
            NULL,
            'whatsapp'
        );
    END IF;

    -- B. ORDER_DELIVERED
    IF (TG_OP = 'UPDATE' AND OLD.status <> 'delivered' AND NEW.status = 'delivered') THEN
        PERFORM enqueue_notification_job(
            'ORDER_DELIVERED:' || NEW.order_id::text,
            'ORDER_DELIVERED',
            v_order.customer_mobile_snapshot,
            'customer_order_delivered',
            jsonb_build_object(
                'order_number', v_order.order_number,
                'customer_name', v_order.customer_name_snapshot,
                'amount_collected', COALESCE(NEW.cod_amount_collected, v_order.final_payable_amount),
                'cash_paid', NEW.cash_collected_amount,
                'upi_paid', NEW.upi_collected_amount,
                'delivered_at', to_char(COALESCE(NEW.delivered_at, now()), 'HH12:MI AM'),
                'tracking_token', v_order.tracking_token
            ),
            v_order.customer_id,
            v_order.id,
            NULL,
            'whatsapp'
        );
    END IF;

    -- C. DELIVERY_FAILED
    IF (TG_OP = 'UPDATE' AND OLD.status <> 'failed' AND NEW.status = 'failed') THEN
        -- Customer safe notification
        PERFORM enqueue_notification_job(
            'DELIVERY_FAILED:' || NEW.order_id::text,
            'DELIVERY_FAILED',
            v_order.customer_mobile_snapshot,
            'customer_delivery_failed',
            jsonb_build_object(
                'order_number', v_order.order_number,
                'customer_name', v_order.customer_name_snapshot,
                'reason', 'Customer unavailable / Address could not be reached',
                'tracking_token', v_order.tracking_token
            ),
            v_order.customer_id,
            v_order.id,
            NULL,
            'whatsapp'
        );

        -- Owner alert
        SELECT (value->>'owner_mobile') INTO v_owner_mobile
        FROM app_settings WHERE key = 'whatsapp_config';

        IF v_owner_mobile IS NOT NULL THEN
            PERFORM enqueue_notification_job(
                'OWNER_ALERT_DELIVERY_FAILED:' || NEW.id::text,
                'DELIVERY_FAILED',
                v_owner_mobile,
                'owner_delivery_failed',
                jsonb_build_object(
                    'order_number', v_order.order_number,
                    'customer_name', v_order.customer_name_snapshot,
                    'customer_mobile', v_order.customer_mobile_snapshot,
                    'area', v_order.delivery_area_snapshot,
                    'reason', COALESCE(NEW.failure_reason, 'Unreachable')
                ),
                v_order.customer_id,
                v_order.id,
                NULL,
                'whatsapp'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_deliveries_notifications ON deliveries;
CREATE TRIGGER trg_deliveries_notifications
    AFTER UPDATE ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION trg_delivery_status_notification();

-- 10. Trigger: Driver Cash Settlement Discrepancy Alert to Owner
CREATE OR REPLACE FUNCTION trg_driver_settlement_discrepancy_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_mobile TEXT;
    v_driver_name TEXT;
BEGIN
    IF (NEW.difference_amount <> 0.00) THEN
        SELECT (value->>'owner_mobile') INTO v_owner_mobile
        FROM app_settings WHERE key = 'whatsapp_config';

        SELECT full_name INTO v_driver_name
        FROM user_profiles WHERE id = NEW.driver_user_id;

        IF v_owner_mobile IS NOT NULL THEN
            PERFORM enqueue_notification_job(
                'COD_DISCREPANCY:' || NEW.id::text,
                'COD_DISCREPANCY',
                v_owner_mobile,
                'owner_cod_discrepancy',
                jsonb_build_object(
                    'settlement_id', NEW.id,
                    'driver_name', COALESCE(v_driver_name, 'Driver'),
                    'delivery_date', to_char(NEW.delivery_date, 'DD Mon YYYY'),
                    'expected_cash', NEW.expected_cash_amount,
                    'collected_cash', NEW.collected_cash_amount,
                    'handed_over_cash', NEW.handed_over_cash_amount,
                    'difference', NEW.difference_amount,
                    'notes', NEW.notes
                ),
                NULL,
                NULL,
                NULL,
                'whatsapp'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_driver_settlements_notifications ON driver_cash_settlements;
CREATE TRIGGER trg_driver_settlements_notifications
    AFTER INSERT OR UPDATE ON driver_cash_settlements
    FOR EACH ROW
    EXECUTE FUNCTION trg_driver_settlement_discrepancy_notification();

-- 11. Seed WhatsApp Configuration in app_settings
INSERT INTO app_settings (key, value, description)
VALUES 
(
    'whatsapp_config',
    '{
        "enabled": true,
        "provider": "meta_cloud_api",
        "api_version": "v20.0",
        "phone_number_id": "sabjiwala_phone_id_halol",
        "business_account_id": "sabjiwala_waba_id_halol",
        "owner_mobile": "+919876543210",
        "manager_mobile": "+919876543211",
        "support_mobile": "+919876543210",
        "pwa_base_url": "https://sabjiwala.store"
    }'::jsonb,
    'WhatsApp Business API connection, business numbers and storefront PWA configuration'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

INSERT INTO app_settings (key, value, description)
VALUES 
(
    'whatsapp_templates',
    '{
        "customer_order_confirmed": {
            "name_en": "Sabjiwala Order Confirmed",
            "name_gu": "શાકભાજીવાળા ઓર્ડર કન્ફર્મ",
            "meta_template_id": "sabjiwala_order_confirmed_v1",
            "language": "gu_IN"
        },
        "customer_out_for_delivery": {
            "name_en": "Out for Delivery",
            "name_gu": "ઓર્ડર ડિલિવરી માટે નીકળ્યો છે",
            "meta_template_id": "sabjiwala_out_for_delivery_v1",
            "language": "gu_IN"
        },
        "customer_order_delivered": {
            "name_en": "Order Delivered & Bill Summary",
            "name_gu": "ઓર્ડર સફળતાપૂર્વક પહોંચાડ્યો",
            "meta_template_id": "sabjiwala_delivered_bill_v1",
            "language": "gu_IN"
        },
        "customer_delivery_failed": {
            "name_en": "Delivery Attempt Failed",
            "name_gu": "ડિલિવરી પ્રયાસ અસફળ",
            "meta_template_id": "sabjiwala_delivery_failed_v1",
            "language": "gu_IN"
        },
        "owner_procurement_report": {
            "name_en": "8 PM Mandi Procurement Requirement",
            "meta_template_id": "sabjiwala_owner_procurement_v1",
            "language": "en_US"
        },
        "owner_operational_alert": {
            "name_en": "Operational Alert",
            "meta_template_id": "sabjiwala_operational_alert_v1",
            "language": "en_US"
        }
    }'::jsonb,
    'WhatsApp Business template names, Meta template mappings and localization settings'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

INSERT INTO app_settings (key, value, description)
VALUES 
(
    'whatsapp_notification_preferences',
    '{
        "send_customer_order_confirmed": true,
        "send_customer_out_for_delivery": true,
        "send_customer_order_delivered": true,
        "send_customer_delivery_failed": true,
        "send_owner_8pm_procurement": true,
        "send_owner_packing_problem": true,
        "send_owner_delivery_failure": true,
        "send_owner_cod_discrepancy": true
    }'::jsonb,
    'Granular notification channel toggles for customer and owner alerts'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

COMMIT;
