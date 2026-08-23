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
        { success: false, error: 'Unauthorized: Owner or Manager authentication required' },
        { status: 401 }
      );
    }

    const { data: roleRows } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (roleRows || []).map((r) => r.role);
    const isAuthorized = roles.includes('owner') || roles.includes('manager');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Owner or Manager can verify cash settlements' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { settlement_id, status, notes } = body;

    if (!settlement_id) {
      return NextResponse.json({ success: false, error: 'Missing settlement_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('verify_owner_cash_settlement', {
      p_settlement_id: settlement_id,
      p_status: status || 'verified',
      p_notes: notes || null,
      p_owner_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
