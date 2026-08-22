import { getErrorMessage } from '@/lib/errors';
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
    const { delivery_date, delivery_slot, driver_user_id, order_ids, created_by } = body;

    if (!delivery_date || !order_ids || order_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing delivery_date or order_ids' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('create_delivery_batch', {
      p_delivery_date: delivery_date,
      p_delivery_slot: delivery_slot || '10:00 AM - 01:00 PM',
      p_driver_user_id: driver_user_id || null,
      p_order_ids: order_ids,
      p_created_by: created_by || null,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
