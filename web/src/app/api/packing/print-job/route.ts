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

    // 3. Fetch Order Snapshot
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // 4. Fetch Order Items
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name_en_snapshot, product_name_gu_snapshot, variant_name_en_snapshot, variant_name_gu_snapshot, quantity, unit_code_snapshot')
      .eq('order_id', order_id);

    const itemsSummary = (items || []).map((it) => ({
      name_en: it.product_name_en_snapshot,
      name_gu: it.product_name_gu_snapshot,
      variant_en: it.variant_name_en_snapshot,
      variant_gu: it.variant_name_gu_snapshot,
      qty: it.quantity,
      unit: it.unit_code_snapshot,
    }));

    // Format Masked Phone
    const phone = order.customer_mobile_snapshot || '';
    const maskedPhone = phone.length >= 10 ? '******' + phone.slice(-4) : phone;

    // Filter target bags
    const targetBags = bag_id ? bags.filter((b) => b.id === bag_id) : bags;

    // 5. Generate Print Payloads with Barcode & QR SVGs
    const stickers = await Promise.all(
      targetBags.map(async (bag) => {
        const barcodeSvg = generateCode128Svg(bag.bag_barcode, { height: 45, barWidth: 2, showText: true });
        const qrSvg = await generateQrCodeSvg(`https://sabjiwala.in/b/${bag.qr_token}`, { width: 90, margin: 0 });

        return {
          header: 'SABJIWALA',
          order_id: order.id,
          order_number: order.order_number,
          bag_id: bag.id,
          bag_barcode: bag.bag_barcode,
          bag_sequence: bag.bag_sequence,
          total_bags: bag.total_bags_snapshot || targetBags.length,
          customer_name: order.customer_name_snapshot,
          customer_mobile_masked: maskedPhone,
          delivery_date: order.delivery_date,
          delivery_slot: '10:00 AM - 01:00 PM',
          delivery_area: order.delivery_area_snapshot,
          delivery_society_street: order.delivery_society_street_snapshot,
          payment_method: String(order.payment_method).toUpperCase(),
          final_payable_amount: order.final_payable_amount,
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
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
