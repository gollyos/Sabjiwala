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
    const { order_id, collection_method, collected_amount, mismatch_reason, driver_user_id, idempotency_key } = body;

    if (!order_id || !collection_method || collected_amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing order_id, collection_method, or collected_amount' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('complete_order_delivery', {
      p_order_id: order_id,
      p_collection_method: collection_method,
      p_collected_amount: Number(collected_amount),
      p_mismatch_reason: mismatch_reason || null,
      p_driver_user_id: driver_user_id || null,
      p_idempotency_key: idempotency_key || null,
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
