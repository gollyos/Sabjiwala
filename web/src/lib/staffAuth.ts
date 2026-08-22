import { createClient } from '@/lib/supabase/server';

export type StaffRole = 'owner' | 'manager' | 'packing' | 'delivery';

const VALID_ROLES: readonly StaffRole[] = ['owner', 'manager', 'packing', 'delivery'];

export interface StaffSession {
  userId: string;
  roles: StaffRole[];
}

/**
 * Resolve the signed-in staff user and their roles from the verified session.
 * Route handlers must use this instead of trusting user ids / override flags
 * sent in the request body, so audit trails cannot be forged.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const roles = (roleRows || [])
    .map((r: { role: string }) => r.role as StaffRole)
    .filter((role) => VALID_ROLES.includes(role));

  return { userId: user.id, roles };
}

export function hasAnyRole(session: StaffSession, ...required: StaffRole[]): boolean {
  return required.some((role) => session.roles.includes(role));
}
