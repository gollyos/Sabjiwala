import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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
    if (!token || typeof token !== 'string' || token.trim().length < 8) {
      return NextResponse.json({ success: false, error: 'Invalid tracking token' }, { status: 400 });
    }

    const serviceSupabase = getServiceSupabase();
    const serverSupabase = await createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    // 1. Primary lookup by secure tracking_token
    const orderLookup = await serviceSupabase
      .from('orders')
      .select(`
        id,
        order_number,
        tracking_token,
        customer_id,
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
      `)
      .eq('tracking_token', token)
      .maybeSingle();
    let order = orderLookup.data;
    const error = orderLookup.error;

    // 2. If not matched by tracking_token, allow UUID lookup ONLY if user is authenticated and owns order or is staff
    if (!order && user) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      if (isUuid) {
        // Check if user is staff
        const { data: staffRoles } = await serverSupabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const isStaff = (staffRoles || []).length > 0;

        // Check if user is customer owner
        const { data: customerRow } = await serverSupabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        const { data: matchedOrder } = await serviceSupabase
          .from('orders')
          .select(`
            id,
            order_number,
            tracking_token,
            customer_id,
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
          `)
          .eq('id', token)
          .maybeSingle();

        if (matchedOrder && (isStaff || (customerRow && matchedOrder.customer_id === customerRow.id))) {
          order = matchedOrder;
        }
      }
    }

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found or tracking token invalid' },
        { status: 404 }
      );
    }

    // Mask customer mobile for privacy (e.g. ******3210) — tracking links are
    // forwarded on WhatsApp, so only the last 4 digits may be exposed.
    const rawMobile = order.customer_mobile_snapshot || '';
    const maskedMobile = rawMobile.length >= 10
      ? `******${rawMobile.slice(-4)}`
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
        items: (order.order_items || []).map((item: {
          product_name_en_snapshot: string;
          product_name_gu_snapshot: string;
          variant_name_en_snapshot: string;
          quantity: number;
          unit_code_snapshot: string;
          selling_price_snapshot: number;
          line_total: number;
        }) => ({
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Error tracking order';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
