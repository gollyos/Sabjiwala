import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { generateCode128Svg } from '@/lib/barcode';
import { generateQrCodeSvg } from '@/lib/qr';

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
        { success: false, error: 'Unauthorized: Staff authentication required' },
        { status: 401 }
      );
    }

    const { data: roleRows } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (roleRows || []).map((r) => r.role);
    const isAuthorized = roles.includes('packing') || roles.includes('manager') || roles.includes('owner');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Packing authorization required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { order_id, bag_id, is_reprint, reprint_reason, idempotency_key } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: 'Missing order_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Fetch bags for the order
    const { data: bags, error: bagsErr } = await supabase
      .from('packing_bags')
      .select('*')
      .eq('order_id', order_id)
      .order('bag_sequence', { ascending: true });

    if (bagsErr || !bags || bags.length === 0) {
      return NextResponse.json({ success: false, error: 'No packing bags found for order.' }, { status: 404 });
    }

    // 2. Queue Job in Database
    const { data: queueResult, error: queueErr } = await supabase.rpc('queue_bag_sticker_print_job', {
      p_order_id: order_id,
      p_bag_id: bag_id || null,
      p_is_reprint: Boolean(is_reprint),
      p_reprint_reason: reprint_reason || null,
      p_requested_by: user.id,
      p_idempotency_key: idempotency_key || null,
    });

    if (queueErr) {
      return NextResponse.json({ success: false, error: queueErr.message }, { status: 500 });
    }

    // 3. Fetch Order Snapshot with Financials
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // 4. Fetch Order Items with Prices & Totals
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name_en_snapshot, product_name_gu_snapshot, variant_name_en_snapshot, variant_name_gu_snapshot, quantity, unit_code_snapshot, selling_price_snapshot, line_total')
      .eq('order_id', order_id);

    const itemsSummary = (items || []).map((it) => ({
      name_en: it.product_name_en_snapshot,
      name_gu: it.product_name_gu_snapshot,
      variant_en: it.variant_name_en_snapshot,
      variant_gu: it.variant_name_gu_snapshot,
      qty: Number(it.quantity || 1),
      unit: it.unit_code_snapshot,
      unit_price: Number(it.selling_price_snapshot || 0),
      line_total: Number(it.line_total || (Number(it.selling_price_snapshot || 0) * Number(it.quantity || 1))),
    }));

    const phone = order.customer_mobile_snapshot || '';

    // Filter target bags
    const targetBags = bag_id ? bags.filter((b) => b.id === bag_id) : bags;

    // 5. Generate Print Payloads with Full Bill Details, Barcode & QR SVGs
    const stickers = await Promise.all(
      targetBags.map(async (bag) => {
        const barcodeSvg = generateCode128Svg(bag.bag_barcode, { height: 40, barWidth: 2, showText: true });
        const qrSvg = await generateQrCodeSvg(`https://sabjiwala.in/b/${bag.qr_token}`, { width: 80, margin: 0 });

        return {
          header: 'SABJIWALA',
          order_id: order.id,
          order_number: order.order_number,
          order_date: order.created_at || order.placed_at,
          bag_id: bag.id,
          bag_barcode: bag.bag_barcode,
          bag_sequence: bag.bag_sequence,
          total_bags: bag.total_bags_snapshot || targetBags.length,
          customer_name: order.customer_name_snapshot,
          customer_mobile: phone,
          customer_mobile_masked: phone,
          delivery_date: order.delivery_date,
          delivery_slot: '10:00 AM - 01:00 PM',
          delivery_area: order.delivery_area_snapshot,
          delivery_society_street: order.delivery_society_street_snapshot,
          delivery_flat_house: order.delivery_flat_house_snapshot,
          delivery_landmark: order.delivery_landmark_snapshot,
          payment_method: String(order.payment_method || 'COD').toUpperCase(),
          payment_status: String(order.payment_status || 'PENDING').toUpperCase(),
          subtotal_amount: Number(order.subtotal_amount || 0),
          promo_discount: Number(order.promo_discount || 0),
          first_order_discount: Number(order.first_order_discount || 0),
          cod_discount: Number(order.cod_discount || 0),
          discount_amount: Number(order.promo_discount || 0) + Number(order.first_order_discount || 0) + Number(order.cod_discount || 0),
          delivery_charge: Number(order.delivery_charge || 0),
          final_payable_amount: Number(order.final_payable_amount || 0),
          collect_cash_text: `COLLECT ₹${Number(order.final_payable_amount).toFixed(2)}`,
          qr_token: bag.qr_token,
          qr_url: `https://sabjiwala.in/b/${bag.qr_token}`,
          items_summary: itemsSummary,
          is_reprint: Boolean(is_reprint),
          reprint_reason: reprint_reason || undefined,
          printed_at: new Date().toISOString(),
          barcodeSvg,
          qrSvg,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        print_job: queueResult,
        stickers,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
