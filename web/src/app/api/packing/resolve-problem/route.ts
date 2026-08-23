import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getStaffSession, hasAnyRole } from '@/lib/staffAuth';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

// Statuses a problem order may be resolved back into. 'problem' itself is
// excluded — resolving must move the order out of the problem state.
const RESOLVABLE_STATUSES = ['waiting', 'packing', 'packed', 'verified'] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    // The RPC stamps the audit log with actor_role 'manager', so only
    // owner/manager sessions may call it; the resolver id always comes from
    // the session, never the request body.
    if (!hasAnyRole(session, 'owner', 'manager')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only owner or manager can resolve packing problems' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, resolution_notes, resolved_status } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: 'Missing order_id' }, { status: 400 });
    }

    const targetStatus = RESOLVABLE_STATUSES.includes(resolved_status) ? resolved_status : 'packing';

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('resolve_order_packing_problem', {
      p_order_id: order_id,
      p_resolution_notes: resolution_notes || 'Problem resolved by manager.',
      p_resolved_status: targetStatus,
      p_manager_user_id: session.userId,
    });

    if (error) {
      return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
