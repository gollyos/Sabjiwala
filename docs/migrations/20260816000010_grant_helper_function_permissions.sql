-- =============================================================================
-- GRANT EXECUTE ON HELPER FUNCTIONS TO ANONYMOUS AND AUTHENTICATED
-- Required for evaluating RLS policy conditions without permission errors
-- =============================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(staff_role_type) TO anon, authenticated;

COMMIT;
