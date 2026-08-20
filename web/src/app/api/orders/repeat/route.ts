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
    const serviceSupabase = getServiceSupabase();
    const serverSupabase = await createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    const body = await req.json().catch(() => ({}));
    const { order_id, tracking_token } = body;

    if (!order_id && !tracking_token) {
      return NextResponse.json(
        { success: false, error: 'order_id or tracking_token is required' },
        { status: 400 }
      );
    }

    // 1. Fetch historical order line items
    let query = serviceSupabase.from('orders').select(`
      id,
      order_number,
      customer_id,
      tracking_token,
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

    const { data: order, error: orderErr } = await query.maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // If accessed via order_id without tracking_token, verify caller session owns order or is staff
    if (!tracking_token) {
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Authentication required to repeat order by ID' },
          { status: 401 }
        );
      }

      const { data: customerRow } = await serverSupabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const { data: staffRoles } = await serverSupabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isStaff = (staffRoles || []).length > 0;
      const isOwner = customerRow && customerRow.id === order.customer_id;

      if (!isStaff && !isOwner) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You cannot repeat another customer\'s order' },
          { status: 403 }
        );
      }
    }

    // 2. Fetch current live catalog variants & products to get authoritative today's price & availability
    const historicalItems = order.order_items || [];
    const variantIds = historicalItems.map((i: { variant_id: string }) => i.variant_id).filter(Boolean);
    const productIds = historicalItems.map((i: { product_id: string }) => i.product_id).filter(Boolean);

    const [{ data: liveVariants }, { data: liveProducts }] = await Promise.all([
      serviceSupabase
        .from('public_catalog_variants')
        .select(`
          id,
          product_id,
          variant_name_en,
          variant_name_gu,
          unit_code,
          unit_value,
          selling_price,
          is_active
        `)
        .in('id', variantIds),
      serviceSupabase
        .from('public_catalog_products')
        .select(`
          id,
          category_id,
          name_en,
          name_gu,
          image_url,
          unit_code,
          is_active
        `)
        .in('id', productIds),
    ]);

    const liveVariantMap = new Map((liveVariants || []).map((v) => [v.id, v]));
    const liveProductMap = new Map((liveProducts || []).map((p) => [p.id, p]));

    const reconciledCartItems = historicalItems.map((item: {
      product_id: string;
      variant_id: string;
      product_name_en_snapshot: string;
      product_name_gu_snapshot: string;
      variant_name_en_snapshot: string;
      unit_code_snapshot: string;
      quantity: number;
    }) => {
      const liveV = liveVariantMap.get(item.variant_id);
      const liveP = liveProductMap.get(item.product_id);

      if (!liveV || !liveV.is_active || !liveP || !liveP.is_active) {
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
          product: liveP || null,
          variant: liveV || null,
        };
      }

      return {
        product_id: item.product_id,
        variant_id: liveV.id,
        name_en: liveP.name_en || item.product_name_en_snapshot,
        name_gu: liveP.name_gu || item.product_name_gu_snapshot,
        unit: liveV.unit_code,
        quantity: item.quantity,
        is_available: true,
        current_price: liveV.selling_price,
        status_note: 'Available at today’s mandi price',
        product: liveP,
        variant: liveV,
      };
    });

    return NextResponse.json({
      success: true,
      original_order_number: order.order_number,
      items: reconciledCartItems,
      available_count: reconciledCartItems.filter((i: { is_available: boolean }) => i.is_available).length,
      unavailable_count: reconciledCartItems.filter((i: { is_available: boolean }) => !i.is_available).length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error repeating order';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
