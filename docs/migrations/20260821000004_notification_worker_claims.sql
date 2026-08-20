-- Atomic notification worker claims prevent duplicate WhatsApp sends when
-- multiple cron invocations overlap or a worker restarts.

BEGIN;

ALTER TABLE public.notification_jobs
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_notification_jobs(
    p_limit INT DEFAULT 20,
    p_job_id UUID DEFAULT NULL
)
RETURNS SETOF public.notification_jobs AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT queued_jobs.id
        FROM public.notification_jobs AS queued_jobs
        WHERE (
                queued_jobs.status = 'queued'
                OR (
                    queued_jobs.status = 'processing'
                    AND queued_jobs.claimed_at < now() - INTERVAL '10 minutes'
                )
              )
          AND queued_jobs.scheduled_at <= now()
          AND queued_jobs.retry_count < queued_jobs.max_retries
          AND (p_job_id IS NULL OR queued_jobs.id = p_job_id)
        ORDER BY queued_jobs.created_at
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
    )
    UPDATE public.notification_jobs jobs
    SET status = 'processing',
        claimed_at = now(),
        updated_at = now()
    FROM candidates
    WHERE jobs.id = candidates.id
    RETURNING jobs.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.claim_notification_jobs(INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_jobs(INT, UUID) TO service_role;

COMMIT;
