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
    const { order_id, staff_user_id, staff_name, device_session, force_override } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: 'Missing order_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('start_order_packing', {
      p_order_id: order_id,
      p_staff_user_id: staff_user_id || null,
      p_staff_name: staff_name || 'Packing Staff',
      p_device_session: device_session || null,
      p_force_override: Boolean(force_override),
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
