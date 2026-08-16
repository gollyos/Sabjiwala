import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driver_id');
    const date = searchParams.get('date') || null;

    if (!driverId) {
      return NextResponse.json({ success: false, error: 'Missing driver_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('get_driver_deliveries_summary', {
      p_driver_user_id: driverId,
      p_delivery_date: date,
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
