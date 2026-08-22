import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

export const revalidate = 10; // Cache for 10 seconds for high performance

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Fetch launch_campaign setting from app_settings
    const { data: settingRow, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'launch_campaign')
      .single();

    if (error || !settingRow) {
      // Fallback default campaign
      return NextResponse.json({
        success: true,
        campaign: {
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
        },
      });
    }

    return NextResponse.json({
      success: true,
      campaign: settingRow.value,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? getErrorMessage(err) : 'Error fetching campaign';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
