import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const { data: settingsRows, error } = await supabase
      .from('app_settings')
      .select('key, value, description, updated_at, updated_by');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const settingsMap: Record<string, any> = {};
    (settingsRows || []).forEach((row) => {
      settingsMap[row.key] = row.value;
    });

    // Also fetch FIRST500 promotion stats for display
    const { data: first500Promo } = await supabase
      .from('promotions')
      .select('*')
      .eq('promo_code', 'FIRST500')
      .single();

    const { count: consumedCount } = await supabase
      .from('promotion_usage')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'consumed');

    const { count: reservedCount } = await supabase
      .from('promotion_usage')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'reserved');

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      promotion_stats: {
        first500: {
          is_active: first500Promo?.is_active ?? true,
          discount_percentage: first500Promo?.discount_percentage ?? 10,
          max_quota: 500,
          consumed: consumedCount || 0,
          reserved: reservedCount || 0,
          remaining: Math.max(0, 500 - ((consumedCount || 0) + (reservedCount || 0))),
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error fetching settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await req.json().catch(() => ({}));
    const { key, value, admin_id } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Setting key and value are required' },
        { status: 400 }
      );
    }

    // Call update_business_setting RPC or direct update
    if (admin_id) {
      const { data, error } = await supabase.rpc('update_business_setting', {
        p_admin_id: admin_id,
        p_key: key,
        p_value: value,
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json(data);
    }

    // Service role fallback update
    const { error: upsertErr } = await supabase
      .from('app_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      });

    if (upsertErr) {
      return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      key,
      message: `Setting ${key} updated successfully`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error updating settings' },
      { status: 500 }
    );
  }
}
