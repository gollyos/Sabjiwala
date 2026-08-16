import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, failure_reason, notes, driver_user_id } = body;

    if (!order_id || !failure_reason) {
      return NextResponse.json(
        { success: false, error: 'Missing order_id or failure_reason' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('record_delivery_failure', {
      p_order_id: order_id,
      p_failure_reason: failure_reason,
      p_notes: notes || null,
      p_driver_user_id: driver_user_id || null,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
