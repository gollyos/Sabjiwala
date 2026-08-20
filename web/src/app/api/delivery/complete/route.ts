import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.');
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createClient();
    const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    // Verify staff role
    const { data: userRoles } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map(r => r.role);
    const isDeliveryStaff = roles.includes('delivery') || roles.includes('manager') || roles.includes('owner');

    if (!isDeliveryStaff) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only delivery or administrative staff can complete deliveries' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, collection_method, collected_amount, mismatch_reason, driver_user_id, idempotency_key } = body;

    if (!order_id || !collection_method || collected_amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing order_id, collection_method, or collected_amount' },
        { status: 400 }
      );
    }

    // Enforce driver user id: if delivery driver, always use caller's user.id
    const effectiveDriverId = roles.includes('owner') || roles.includes('manager')
      ? (driver_user_id || user.id)
      : user.id;

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('complete_order_delivery', {
      p_order_id: order_id,
      p_collection_method: collection_method,
      p_collected_amount: Number(collected_amount),
      p_mismatch_reason: mismatch_reason || null,
      p_driver_user_id: effectiveDriverId,
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
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
