-- Allow authenticated staff to resolve their own role without exposing other users.
-- Required by the Next.js proxy and the client-side operations shell.

BEGIN;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

COMMIT;
