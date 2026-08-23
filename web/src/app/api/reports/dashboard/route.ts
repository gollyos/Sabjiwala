import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

function resolveDates(range: string | null, customStart: string | null, customEnd: string | null) {
  // Current time in Asia/Kolkata
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  const format = (d: Date) => d.toISOString().split('T')[0];

  const todayStr = format(istNow);

  if (range === 'yesterday') {
    const yest = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
    const yestStr = format(yest);
    const dayBefore = new Date(istNow.getTime() - 2 * 24 * 60 * 60 * 1000);
    return {
      start_date: yestStr,
      end_date: yestStr,
      compare_start_date: format(dayBefore),
      compare_end_date: format(dayBefore),
    };
  }

  if (range === 'last_7_days') {
    const start = new Date(istNow.getTime() - 6 * 24 * 60 * 60 * 1000);
    const compEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const compStart = new Date(compEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
    return {
      start_date: format(start),
      end_date: todayStr,
      compare_start_date: format(compStart),
      compare_end_date: format(compEnd),
    };
  }

  if (range === 'last_30_days') {
    const start = new Date(istNow.getTime() - 29 * 24 * 60 * 60 * 1000);
    const compEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const compStart = new Date(compEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
    return {
      start_date: format(start),
      end_date: todayStr,
      compare_start_date: format(compStart),
      compare_end_date: format(compEnd),
    };
  }

  if (range === 'this_month') {
    const year = istNow.getFullYear();
    const month = istNow.getMonth();
    const start = new Date(year, month, 1);
    const compStart = new Date(year, month - 1, 1);
    const compEnd = new Date(year, month, 0);
    return {
      start_date: format(start),
      end_date: todayStr,
      compare_start_date: format(compStart),
      compare_end_date: format(compEnd),
    };
  }

  if (range === 'last_month') {
    const year = istNow.getFullYear();
    const month = istNow.getMonth();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const compStart = new Date(year, month - 2, 1);
    const compEnd = new Date(year, month - 1, 0);
    return {
      start_date: format(start),
      end_date: format(end),
      compare_start_date: format(compStart),
      compare_end_date: format(compEnd),
    };
  }

  if (range === 'custom' && customStart && customEnd) {
    return {
      start_date: customStart,
      end_date: customEnd,
      compare_start_date: null,
      compare_end_date: null,
    };
  }

  // Default: Today vs Yesterday
  const yest = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
  const yestStr = format(yest);
  return {
    start_date: todayStr,
    end_date: todayStr,
    compare_start_date: yestStr,
    compare_end_date: yestStr,
  };
}

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = await createClient();
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    // Verify Owner or Manager role
    const { data: userRoles } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map(r => r.role);
    if (!roles.includes('owner') && !roles.includes('manager')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient privileges for executive financial reports' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range');
    const customStart = searchParams.get('start_date');
    const customEnd = searchParams.get('end_date');

    const { start_date, end_date, compare_start_date, compare_end_date } = resolveDates(
      range,
      customStart,
      customEnd
    );

    const supabase = getServiceSupabase();

    // 1. Dashboard Analytics
    const { data: analytics, error: analErr } = await supabase.rpc('get_owner_dashboard_analytics', {
      p_start_date: start_date,
      p_end_date: end_date,
      p_compare_start_date: compare_start_date,
      p_compare_end_date: compare_end_date,
    });

    if (analErr) {
      return NextResponse.json({ success: false, error: getErrorMessage(analErr) }, { status: 500 });
    }

    // 2. Daily Executive Summary for today or end_date
    const { data: dailySummary, error: dailyErr } = await supabase.rpc('get_daily_owner_summary', {
      p_date: end_date,
    });

    if (dailyErr) {
      console.warn('Daily summary warning:', dailyErr.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...analytics,
        daily_summary: dailySummary || null,
        active_range: range || 'today',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
