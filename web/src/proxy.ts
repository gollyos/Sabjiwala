import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type StaffRole = 'owner' | 'manager' | 'packing' | 'delivery';

const API_ROLE_RULES: Array<{ prefix: string; roles: ReadonlySet<StaffRole> }> = [
  { prefix: '/api/staff', roles: new Set(['owner']) },
  { prefix: '/api/seed', roles: new Set(['owner']) },
  { prefix: '/api/reports/', roles: new Set(['owner', 'manager']) },
  { prefix: '/api/settings', roles: new Set(['owner', 'manager']) },
  { prefix: '/api/procurement/', roles: new Set(['owner', 'manager']) },
  { prefix: '/api/packing/', roles: new Set(['owner', 'manager', 'packing']) },
  { prefix: '/api/delivery/admin-summary', roles: new Set(['owner', 'manager']) },
  // Drivers start their own runs; batch creation stays owner/manager below.
  { prefix: '/api/delivery/batch/start', roles: new Set(['owner', 'manager', 'delivery']) },
  { prefix: '/api/delivery/batch/', roles: new Set(['owner', 'manager']) },
  { prefix: '/api/delivery/settlement/verify', roles: new Set(['owner', 'manager']) },
  { prefix: '/api/delivery/', roles: new Set(['owner', 'manager', 'delivery']) },
  { prefix: '/api/automation/', roles: new Set(['owner', 'manager']) },
  { prefix: '/api/notifications/queue', roles: new Set(['owner', 'manager']) },
  { prefix: '/api/notifications/retry', roles: new Set(['owner', 'manager']) },
];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const matchingRule = API_ROLE_RULES.find(({ prefix }) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (matchingRule) {
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const hasStaffRole = roleRows?.some(({ role }) =>
      matchingRule.roles.has(role as StaffRole)
    );

    if (!hasStaffRole) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to perform this operation.' },
        { status: 403 }
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
