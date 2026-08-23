import { createClient } from '@supabase/supabase-js';

// Memoized so the JWT is only decoded/verified once per process, not on every
// createAdminClient() call.
let verifiedServiceRoleKey: string | null = null;

/**
 * Decode a JWT's payload (no signature verification — we only need the
 * `role` claim) and confirm it really is a service-role key. A misconfigured
 * deployment that swaps in the anon key here would otherwise silently run
 * every "admin" query under anon privileges, which is effectively as bad as
 * having no backend at all.
 */
function assertServiceRoleKey(key: string): void {
  if (verifiedServiceRoleKey === key) return;

  const parts = key.split('.');
  if (parts.length !== 3) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY does not look like a valid JWT (expected 3 dot-separated segments). ' +
      "Get the correct key from Supabase Dashboard > Project Settings > API."
    );
  }

  let role: unknown;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    role = JSON.parse(payloadJson).role;
  } catch {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY JWT payload could not be decoded/parsed. ' +
      "Get the correct key from Supabase Dashboard > Project Settings > API."
    );
  }

  if (role !== 'service_role') {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is not a real service-role key — its JWT role claim is ${JSON.stringify(role)}, ` +
      "expected 'service_role'. Get the correct key from Supabase Dashboard > Project Settings > API."
    );
  }

  verifiedServiceRoleKey = key;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured.');
  }

  assertServiceRoleKey(serviceRoleKey);

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
