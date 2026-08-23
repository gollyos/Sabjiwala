import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getStaffSession, hasAnyRole } from '@/lib/staffAuth';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (!hasAnyRole(session, 'owner', 'manager', 'packing')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only packing or administrative staff can view the packing queue' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || null;
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || null;

    const supabase = getServiceSupabase();

    // 1. Fetch Packing Queue
    const { data: queueData, error: queueErr } = await supabase.rpc('get_packing_queue', {
      p_delivery_date: date,
      p_status_filter: status,
      p_search_term: search,
    });

    if (queueErr) {
      return NextResponse.json({ success: false, error: queueErr.message }, { status: 500 });
    }

    // 2. Fetch Dashboard Metrics
    const { data: statsData, error: statsErr } = await supabase.rpc('get_packing_dashboard_stats', {
      p_delivery_date: date,
    });

    if (statsErr) {
      return NextResponse.json({ success: false, error: statsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        queue: queueData?.orders || [],
        target_date: queueData?.target_date,
        stats: statsData,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
