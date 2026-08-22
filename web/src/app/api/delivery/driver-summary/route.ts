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
    const isStaff = roles.includes('delivery') || roles.includes('manager') || roles.includes('owner');

    if (!isStaff) {
      return NextResponse.json({ success: false, error: 'Forbidden: Delivery role required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const requestedDriverId = searchParams.get('driver_id');
    const date = searchParams.get('date') || null;

    // Delivery drivers can only query their own runs; Owner/Manager can inspect any driver
    const isManagerOrOwner = roles.includes('owner') || roles.includes('manager');
    const effectiveDriverId = isManagerOrOwner ? (requestedDriverId || user.id) : user.id;

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('get_driver_deliveries_summary', {
      p_driver_user_id: effectiveDriverId,
      p_delivery_date: date,
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
