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
    const date = searchParams.get('date') || null;

    const supabase = getServiceSupabase();

    // 1. Fetch Dashboard Stats & Batches
    const { data: statsData, error: statsErr } = await supabase.rpc('get_admin_delivery_dashboard_stats', {
      p_delivery_date: date,
    });

    if (statsErr) {
      return NextResponse.json({ success: false, error: statsErr.message }, { status: 500 });
    }

    // 2. Fetch Active Drivers for dropdown
    const { data: drivers, error: driverErr } = await supabase
      .from('user_profiles')
      .select('id, full_name, mobile')
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      data: {
        ...statsData,
        drivers: drivers || [],
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
