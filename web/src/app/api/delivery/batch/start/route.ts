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
    if (!hasAnyRole(session, 'owner', 'manager', 'delivery')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only delivery or administrative staff can start delivery runs' }, { status: 403 });
    }

    const body = await req.json();
    const { batch_id, driver_user_id } = body;

    if (!batch_id) {
      return NextResponse.json({ success: false, error: 'Missing batch_id' }, { status: 400 });
    }

    // Driver identity comes from the verified session; owner/manager may
    // start a run on behalf of the assigned driver.
    const effectiveDriverId = hasAnyRole(session, 'owner', 'manager')
      ? (driver_user_id || session.userId)
      : session.userId;

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('start_delivery_batch', {
      p_batch_id: batch_id,
      p_driver_user_id: effectiveDriverId,
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
