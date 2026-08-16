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
    const { order_id, bag_count, staff_user_id, is_manager_override } = body;

    if (!order_id || !bag_count) {
      return NextResponse.json({ success: false, error: 'Missing order_id or bag_count' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('set_order_bag_count', {
      p_order_id: order_id,
      p_bag_count: Number(bag_count),
      p_staff_user_id: staff_user_id || null,
      p_is_manager_override: Boolean(is_manager_override),
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
