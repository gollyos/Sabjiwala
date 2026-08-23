import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { todayIST } from '@/lib/istDate';
import { getStaffSession, hasAnyRole } from '@/lib/staffAuth';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (!hasAnyRole(session, 'owner', 'manager')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient privileges for executive financial reports' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start_date') || todayIST();
    const endDate = searchParams.get('end_date') || todayIST();
    const categoryId = searchParams.get('category_id') || null;
    const productId = searchParams.get('product_id') || null;

    const supabase = getServiceSupabase();

    const { data: result, error } = await supabase.rpc('get_product_reporting_analytics', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_category_id: categoryId,
      p_product_id: productId,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Also fetch categories for filter dropdown
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name_en, name_gu')
      .order('display_order', { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        categories: categories || [],
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
