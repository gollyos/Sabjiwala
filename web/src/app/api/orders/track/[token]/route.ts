import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getServiceSupabase();

    // Check if token matches tracking_token or order id
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        delivery_date,
        delivery_slot_start,
        delivery_slot_end,
        order_status,
        payment_status,
        payment_method,
        subtotal_amount,
        first_order_discount,
        cod_discount,
        final_payable_amount,
        delivery_flat_house_snapshot,
        delivery_society_street_snapshot,
        delivery_landmark_snapshot,
        delivery_area_snapshot,
        customer_name_snapshot,
        customer_mobile_snapshot,
        created_at,
        order_items (
          id,
          product_name_en_snapshot,
          product_name_gu_snapshot,
          variant_name_en_snapshot,
          quantity,
          equivalent_base_qty,
          unit_code_snapshot,
          selling_price_snapshot,
          line_total
        )
      `);

    if (token.length === 32 || token.length === 64) {
      query = query.eq('tracking_token', token);
    } else {
      query = query.or(`tracking_token.eq.${token},id.eq.${token}`);
    }

    const { data: order, error } = await query.single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found or link has expired' },
        { status: 404 }
      );
    }

    // Mask customer mobile for privacy (e.g. +91 98765 ****0)
    const rawMobile = order.customer_mobile_snapshot || '';
    const maskedMobile = rawMobile.length >= 10
      ? `${rawMobile.slice(0, -4)}****`
      : rawMobile;

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        delivery_date: order.delivery_date,
        delivery_slot: '10:00 AM - 1:00 PM',
        status: order.order_status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        subtotal: order.subtotal_amount,
        first500_discount: order.first_order_discount,
        cod_discount: order.cod_discount,
        final_payable: order.final_payable_amount,
        customer_name: order.customer_name_snapshot,
        customer_mobile: maskedMobile,
        delivery_address: {
          flat_house: order.delivery_flat_house_snapshot,
          society_street: order.delivery_society_street_snapshot,
          landmark: order.delivery_landmark_snapshot,
          area: order.delivery_area_snapshot,
        },
        items: (order.order_items || []).map((item: any) => ({
          name_en: item.product_name_en_snapshot,
          name_gu: item.product_name_gu_snapshot,
          variant: item.variant_name_en_snapshot,
          quantity: item.quantity,
          unit: item.unit_code_snapshot,
          price: item.selling_price_snapshot,
          line_total: item.line_total,
        })),
        created_at: order.created_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error tracking order' },
      { status: 500 }
    );
  }
}
