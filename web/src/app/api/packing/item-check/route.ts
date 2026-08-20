import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.');
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_item_id, packed_quantity, is_confirmed, notes, staff_user_id } = body;

    if (!order_item_id) {
      return NextResponse.json({ success: false, error: 'Missing order_item_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('update_order_item_packed_status', {
      p_order_item_id: order_item_id,
      p_packed_quantity: packed_quantity !== undefined ? Number(packed_quantity) : null,
      p_is_confirmed: is_confirmed !== undefined ? Boolean(is_confirmed) : true,
      p_notes: notes || null,
      p_staff_user_id: staff_user_id || null,
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
