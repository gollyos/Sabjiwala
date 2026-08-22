import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getStaffSession, hasAnyRole } from '@/lib/staffAuth';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (!hasAnyRole(session, 'owner', 'manager', 'packing')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only packing or administrative staff can change bag counts' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, bag_count, is_manager_override } = body;

    if (!order_id || !bag_count) {
      return NextResponse.json({ success: false, error: 'Missing order_id or bag_count' }, { status: 400 });
    }

    // Override is a server-verified privilege, never a client flag: only
    // owner/manager callers may unlock bag-count changes on verified orders.
    // The audit actor is always the signed-in user.
    const overrideAllowed = hasAnyRole(session, 'owner', 'manager');
    const effectiveOverride = overrideAllowed && Boolean(is_manager_override);

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('set_order_bag_count', {
      p_order_id: order_id,
      p_bag_count: Number(bag_count),
      p_staff_user_id: session.userId,
      p_is_manager_override: effectiveOverride,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
