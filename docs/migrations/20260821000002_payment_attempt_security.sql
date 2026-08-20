-- Persist Razorpay order IDs server-side and prevent customers from invoking
-- privileged settlement RPCs directly.

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_gateway_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    gateway_order_id VARCHAR(100) NOT NULL UNIQUE,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'captured', 'failed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '20 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_attempts_order
    ON public.payment_gateway_attempts(order_id, created_at DESC);

ALTER TABLE public.payment_gateway_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_attempts_customer_read ON public.payment_gateway_attempts;
CREATE POLICY payment_attempts_customer_read ON public.payment_gateway_attempts
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT id FROM public.customers WHERE auth_user_id = (SELECT auth.uid())
        )
    );

REVOKE ALL ON public.payment_gateway_attempts FROM anon, authenticated;
GRANT SELECT ON public.payment_gateway_attempts TO authenticated;
GRANT ALL ON public.payment_gateway_attempts TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_online_payment_capture(
    UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, TIMESTAMPTZ, UUID, JSONB
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_online_payment_capture(
    UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, TIMESTAMPTZ, UUID, JSONB
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_online_payment_failure(
    UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, UUID, JSONB
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_online_payment_failure(
    UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, UUID, JSONB
) TO service_role;

COMMIT;
