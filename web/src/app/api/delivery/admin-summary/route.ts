import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = await createClient();
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const { data: userRoles } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map(r => r.role);
    if (!roles.includes('owner') && !roles.includes('manager')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Owner or Manager role required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || null;

    const supabase = getServiceSupabase();

    // 1. Fetch Dashboard Stats & Batches
    const { data: statsData, error: statsErr } = await supabase.rpc('get_admin_delivery_dashboard_stats', {
      p_delivery_date: date,
    });

    if (statsErr) {
      return NextResponse.json({ success: false, error: getErrorMessage(statsErr) }, { status: 500 });
    }

    // 2. Fetch Active Drivers with delivery role for assignment dropdown
    const { data: driverRoles } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        user_profiles!inner (
          id,
          full_name,
          mobile,
          is_active
        )
      `)
      .eq('role', 'delivery');

    const drivers = (driverRoles || [])
      .map((dr: any) => dr.user_profiles)
      .filter((p: any) => p && p.is_active);

    // 3. Fetch Failed Deliveries eligible for reschedule (the RPC above only
    // returns the failed *count* — the reschedule action needs the actual list).
    const targetDate = (statsData as any)?.delivery_date || date;
    const { data: failedRows } = await supabase
      .from('deliveries')
      .select(`
        id,
        order_id,
        failure_reason,
        updated_at,
        orders!inner (
          order_number,
          customer_name_snapshot,
          customer_mobile_snapshot,
          delivery_area_snapshot,
          delivery_date
        )
      `)
      .eq('status', 'failed')
      .eq('orders.delivery_date', targetDate);

    const failedDeliveries = (failedRows || []).map((r: any) => ({
      delivery_id: r.id,
      order_id: r.order_id,
      order_number: r.orders?.order_number,
      customer_name_snapshot: r.orders?.customer_name_snapshot,
      customer_mobile_snapshot: r.orders?.customer_mobile_snapshot,
      delivery_area_snapshot: r.orders?.delivery_area_snapshot,
      failure_reason: r.failure_reason,
      failed_at: r.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        ...statsData,
        drivers: drivers || [],
        failed_deliveries: failedDeliveries,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
