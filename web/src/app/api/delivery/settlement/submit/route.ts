import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Staff authentication required' },
        { status: 401 }
      );
    }

    const { data: roleRows } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (roleRows || []).map((r) => r.role);
    const hasAccess = roles.includes('delivery') || roles.includes('manager') || roles.includes('owner');

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient privileges' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { delivery_batch_id, driver_user_id, handed_over_cash, notes } = body;

    // A delivery driver can only submit settlements for themselves
    const effectiveDriverId = (roles.includes('owner') || roles.includes('manager')) && driver_user_id
      ? driver_user_id
      : user.id;

    if (!delivery_batch_id || handed_over_cash === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing delivery_batch_id or handed_over_cash' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('submit_driver_cash_settlement', {
      p_delivery_batch_id: delivery_batch_id,
      p_driver_user_id: effectiveDriverId,
      p_handed_over_cash: Number(handed_over_cash),
      p_notes: notes || null,
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
