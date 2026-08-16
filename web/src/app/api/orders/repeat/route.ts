import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await req.json().catch(() => ({}));
    const { order_id, tracking_token } = body;

    if (!order_id && !tracking_token) {
      return NextResponse.json(
        { success: false, error: 'order_id or tracking_token is required' },
        { status: 400 }
      );
    }

    // 1. Fetch historical order line items
    let query = supabase.from('orders').select(`
      id,
      order_number,
      order_items (
        product_id,
        variant_id,
        quantity,
        product_name_en_snapshot,
        product_name_gu_snapshot,
        variant_name_en_snapshot,
        unit_code_snapshot
      )
    `);

    if (tracking_token) {
      query = query.eq('tracking_token', tracking_token);
    } else {
      query = query.eq('id', order_id);
    }

    const { data: order, error: orderErr } = await query.single();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // 2. Fetch current live catalog variants to get authoritative today's price & availability
    const historicalItems = order.order_items || [];
    const variantIds = historicalItems.map((i: any) => i.variant_id).filter(Boolean);

    const { data: liveVariants } = await supabase
      .from('public_catalog_variants')
      .select(`
        id,
        product_id,
        variant_name_en,
        variant_name_gu,
        unit_code,
        price,
        is_active,
        available_quantity
      `)
      .in('id', variantIds);

    const liveVariantMap = new Map((liveVariants || []).map((v) => [v.id, v]));

    const reconciledCartItems = historicalItems.map((item: any) => {
      const live = liveVariantMap.get(item.variant_id);

      if (!live || !live.is_active) {
        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          name_en: item.product_name_en_snapshot,
          name_gu: item.product_name_gu_snapshot,
          unit: item.unit_code_snapshot,
          quantity: item.quantity,
          is_available: false,
          current_price: 0,
          status_note: 'Currently out of stock (હાલમાં ઉપલબ્ધ નથી)',
        };
      }

      return {
        product_id: item.product_id,
        variant_id: live.id,
        name_en: item.product_name_en_snapshot,
        name_gu: item.product_name_gu_snapshot,
        unit: live.unit_code,
        quantity: item.quantity,
        is_available: true,
        current_price: live.price,
        status_note: 'Available at today’s mandi price',
      };
    });

    return NextResponse.json({
      success: true,
      original_order_number: order.order_number,
      items: reconciledCartItems,
      available_count: reconciledCartItems.filter((i: any) => i.is_available).length,
      unavailable_count: reconciledCartItems.filter((i: any) => !i.is_available).length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error repeating order' },
      { status: 500 }
    );
  }
}
