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
      return NextResponse.json({ success: false, error: 'Forbidden: Only packing or administrative staff can report packing problems' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, problem_type, notes } = body;

    if (!order_id || !problem_type) {
      return NextResponse.json({ success: false, error: 'Missing order_id or problem_type' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('report_order_packing_problem', {
      p_order_id: order_id,
      p_problem_type: problem_type,
      p_notes: notes || null,
      // Audit trail actor always comes from the verified session, never the request body.
      p_staff_user_id: session.userId,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
