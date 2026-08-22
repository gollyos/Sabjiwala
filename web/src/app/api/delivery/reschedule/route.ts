import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getStaffSession, hasAnyRole } from '@/lib/staffAuth';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    // Rescheduling resets an order back into the packing flow — a manager
    // action. The manager identity comes from the session, not the body.
    if (!hasAnyRole(session, 'owner', 'manager')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only owner or manager can reschedule deliveries' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, new_delivery_date, reason } = body;

    if (!order_id || !new_delivery_date) {
      return NextResponse.json(
        { success: false, error: 'Missing order_id or new_delivery_date' },
        { status: 400 }
      );
    }

    if (typeof new_delivery_date !== 'string' || !ISO_DATE.test(new_delivery_date)) {
      return NextResponse.json(
        { success: false, error: 'new_delivery_date must be a valid date (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('reschedule_failed_delivery', {
      p_order_id: order_id,
      p_new_delivery_date: new_delivery_date,
      p_reason: reason || null,
      p_manager_user_id: session.userId,
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
