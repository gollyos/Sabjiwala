import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const PUBLIC_SETTING_KEYS = [
  'business_profile',
  'delivery_zones',
  'min_order_amount',
  'cod_discount_pct',
  'online_discount_pct',
  'first_500_promo',
  'cutoff_time',
  'delivery_cutoff_time',
  'delivery_window',
  'delivery_fee',
  'feature_flags',
  'launch_campaign',
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let isStaffAdmin = false;
    if (user) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const roles = (userRoles || []).map(r => r.role);
      isStaffAdmin = roles.includes('owner') || roles.includes('manager');
    }

    const { data: settingsRows, error } = await supabase
      .from('app_settings')
      .select('key, value, description, updated_at, updated_by');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const settingsMap: Record<string, unknown> = {};
    (settingsRows || []).forEach((row) => {
      if (isStaffAdmin || PUBLIC_SETTING_KEYS.includes(row.key)) {
        settingsMap[row.key] = row.value;
      }
    });

    // Fetch launch_campaign settings and promotion stats
    const campaignVal = (settingsMap.launch_campaign as Record<string, unknown>) || {
      is_active: true,
      promo_code: 'FIRST500',
      title_en: 'Grand Launch Celebration Offer',
      title_gu: 'ગ્રાન્ડ લૉન્ચ ઓફર',
      discount_percentage: 10,
      max_verified_customer_seq: 500,
      max_orders_per_customer: 3,
      min_order_subtotal: 200,
      valid_from: '2026-08-01T00:00:00+05:30',
      valid_until: '2026-10-31T23:59:59+05:30',
      show_timer: true,
      banner_message_en: 'First 500 verified customers in Halol get 10% OFF on their first 3 orders!',
      banner_message_gu: 'હલોલના પ્રથમ 500 ગ્રાહકોને પ્રથમ 3 ઓર્ડર પર 10% છૂટ!',
    };

    const { count: consumedCount } = await supabase
      .from('promotion_usage')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'consumed');

    const { count: reservedCount } = await supabase
      .from('promotion_usage')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'reserved');

    const { count: verifiedCount } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', true);

    const maxQuota = ((campaignVal.max_verified_customer_seq as number) || 500) * ((campaignVal.max_orders_per_customer as number) || 3);

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      promotion_stats: {
        campaign: campaignVal,
        first500: {
          is_active: campaignVal.is_active ?? true,
          discount_percentage: campaignVal.discount_percentage ?? 10,
          max_verified_customer_seq: campaignVal.max_verified_customer_seq ?? 500,
          max_orders_per_customer: campaignVal.max_orders_per_customer ?? 3,
          max_quota: maxQuota,
          consumed: consumedCount || 0,
          reserved: reservedCount || 0,
          remaining: Math.max(0, maxQuota - ((consumedCount || 0) + (reservedCount || 0))),
          total_verified_customers: verifiedCount || 0,
          valid_from: campaignVal.valid_from,
          valid_until: campaignVal.valid_until,
          show_timer: campaignVal.show_timer ?? true,
        },
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching settings';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    // Verify Owner role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map(r => r.role);
    if (!roles.includes('owner')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only Owner can modify business settings' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Setting key and value are required' },
        { status: 400 }
      );
    }

    // Call update_business_setting RPC with verified user.id
    const { data, error } = await supabase.rpc('update_business_setting', {
      p_admin_id: user.id,
      p_key: key,
      p_value: value,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // If updating launch_campaign, also sync promotions table with service client
    if (key === 'launch_campaign' && typeof value === 'object' && value !== null) {
      try {
        const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceUrl && serviceKey) {
          const serviceSupabase = createServiceClient(serviceUrl, serviceKey);
          const campaignObj = value as Record<string, unknown>;
          await serviceSupabase
            .from('promotions')
            .update({
              discount_value: campaignObj.discount_percentage ?? 10.00,
              max_verified_customer_seq: campaignObj.max_verified_customer_seq ?? 500,
              per_customer_limit: campaignObj.max_orders_per_customer ?? 3,
              is_active: campaignObj.is_active ?? true,
              valid_from: campaignObj.valid_from ?? '2026-08-01T00:00:00+05:30',
              valid_until: campaignObj.valid_until ?? '2026-10-31T23:59:59+05:30',
              updated_at: new Date().toISOString(),
            })
            .eq('promo_code', 'FIRST500');
        }
      } catch (syncErr) {
        console.error('Error syncing promotions table:', syncErr);
      }
    }

    return NextResponse.json(data || {
      success: true,
      key,
      message: `Setting ${key} updated successfully`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error updating settings';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
