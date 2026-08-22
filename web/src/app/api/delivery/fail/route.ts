import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getStaffSession, hasAnyRole } from '@/lib/staffAuth';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (!hasAnyRole(session, 'delivery', 'manager', 'owner')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only delivery or administrative staff can report delivery failures' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, delivery_id, failure_reason, notes } = body;

    if ((!order_id && !delivery_id) || !failure_reason) {
      return NextResponse.json(
        { success: false, error: 'Missing order_id (or delivery_id) or failure_reason' },
        { status: 400 }
      );
    }

    // The driver app sends delivery_id; resolve it to the order when needed.
    let effectiveOrderId = order_id as string | undefined;
    const supabase = getServiceSupabase();
    if (!effectiveOrderId && delivery_id) {
      const { data: deliveryRow } = await supabase
        .from('deliveries')
        .select('order_id')
        .eq('id', delivery_id)
        .maybeSingle();
      if (!deliveryRow?.order_id) {
        return NextResponse.json({ success: false, error: 'Delivery assignment not found' }, { status: 404 });
      }
      effectiveOrderId = deliveryRow.order_id as string;
    }

    // Driver identity always comes from the verified session. Owner/manager
    // may attribute the failure to another driver; drivers are forced to
    // themselves so the audit trail cannot be forged.
    const effectiveDriverId = hasAnyRole(session, 'owner', 'manager')
      ? (body.driver_user_id || session.userId)
      : session.userId;

    const { data: result, error } = await supabase.rpc('record_delivery_failure', {
      p_order_id: effectiveOrderId,
      p_failure_reason: failure_reason,
      p_notes: notes || null,
      p_driver_user_id: effectiveDriverId,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
