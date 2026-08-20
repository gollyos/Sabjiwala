-- Durable n8n automation outbox. Business transactions enqueue work; a
-- secret-protected worker claims and dispatches it with retries.

BEGIN;

CREATE TABLE IF NOT EXISTS public.automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    aggregate_type VARCHAR(40) NOT NULL,
    aggregate_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_type, aggregate_type, aggregate_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_claim
    ON public.automation_jobs(status, scheduled_at, created_at);

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automation_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_order_automation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_status = 'confirmed'
       AND (TG_OP = 'INSERT' OR OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
        INSERT INTO public.automation_jobs (event_type, aggregate_type, aggregate_id)
        VALUES ('ORDER_CREATED', 'order', NEW.id)
        ON CONFLICT (event_type, aggregate_type, aggregate_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_orders_automation_outbox ON public.orders;
CREATE TRIGGER trg_orders_automation_outbox
    AFTER INSERT OR UPDATE OF order_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_automation();

CREATE OR REPLACE FUNCTION public.claim_automation_jobs(p_limit INT DEFAULT 10)
RETURNS SETOF public.automation_jobs AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT queued_jobs.id
        FROM public.automation_jobs AS queued_jobs
        WHERE (
                queued_jobs.status IN ('queued', 'failed')
                OR (
                    queued_jobs.status = 'processing'
                    AND queued_jobs.claimed_at < now() - INTERVAL '10 minutes'
                )
              )
          AND queued_jobs.scheduled_at <= now()
          AND queued_jobs.attempts < 5
        ORDER BY queued_jobs.created_at
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)
    )
    UPDATE public.automation_jobs jobs
    SET status = 'processing',
        attempts = jobs.attempts + 1,
        claimed_at = now(),
        updated_at = now()
    FROM candidates
    WHERE jobs.id = candidates.id
    RETURNING jobs.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.claim_automation_jobs(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_automation_jobs(INT) TO service_role;

COMMIT;
