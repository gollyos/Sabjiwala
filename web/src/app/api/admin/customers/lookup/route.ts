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
    const isAuthorized = roles.includes('owner') || roles.includes('manager');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const mobileParam = searchParams.get('mobile')?.trim() || '';
    const cleanMobile = mobileParam.replace(/\D/g, '');

    if (!cleanMobile || cleanMobile.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please provide at least a 10-digit mobile number' },
        { status: 400 }
      );
    }

    const mobileWithCountry = `+91${cleanMobile.slice(-10)}`;
    const supabase = getServiceSupabase();

    // Find customer by mobile
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id, full_name, mobile, alternate_mobile, is_verified')
      .or(`mobile.eq.${mobileWithCountry},mobile.eq.${cleanMobile.slice(-10)}`)
      .maybeSingle();

    if (custError) {
      return NextResponse.json({ success: false, error: getErrorMessage(custError) }, { status: 500 });
    }

    if (!customer) {
      return NextResponse.json({ success: true, customer: null, defaultAddress: null });
    }

    // Find latest or default address
    const { data: address } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('is_deleted', false)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      customer,
      defaultAddress: address || null,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
