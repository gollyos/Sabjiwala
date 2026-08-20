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
    const isAuthorized = roles.includes('manager') || roles.includes('owner') || roles.includes('packing');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Procurement receiving authorization required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { procurement_item_id, received_qty, usable_qty, notes } = body;

    if (!procurement_item_id || received_qty === undefined || usable_qty === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters (procurement_item_id, received_qty, usable_qty)' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('record_procurement_receiving_and_wastage', {
      p_procurement_item_id: procurement_item_id,
      p_received_qty: Number(received_qty),
      p_usable_qty: Number(usable_qty),
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
