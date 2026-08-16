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
    const { delivery_batch_id, driver_user_id, handed_over_cash, notes } = body;

    if (!delivery_batch_id || !driver_user_id || handed_over_cash === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing delivery_batch_id, driver_user_id, or handed_over_cash' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('submit_driver_cash_settlement', {
      p_delivery_batch_id: delivery_batch_id,
      p_driver_user_id: driver_user_id,
      p_handed_over_cash: Number(handed_over_cash),
      p_notes: notes || null,
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
