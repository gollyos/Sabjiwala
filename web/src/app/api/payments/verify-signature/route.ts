import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RazorpayService } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters for signature verification.' },
        { status: 400 }
      );
    }

    // 1. Verify Browser HMAC-SHA256 Signature using Razorpay Key Secret
    const isValidSignature = RazorpayService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValidSignature) {
      console.warn(`[SECURITY] Invalid Razorpay browser signature detected for order ${order_id}`);
      return NextResponse.json(
        { success: false, error: 'Payment signature verification failed. Untrusted response.' },
        { status: 400 }
      );
    }

    // 2. Fetch internal order to verify ownership and amount
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, final_payable_amount, order_status, payment_status, customers!inner(auth_user_id)')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    const customerData = order.customers as unknown as { auth_user_id: string };
    if (customerData.auth_user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Access denied.' },
        { status: 403 }
      );
    }

    // 3. Confirm captured payment via atomic RPC
    const { data: confirmation, error: confirmErr } = await supabase.rpc('confirm_online_payment_capture', {
      p_order_id: order.id,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_payment_amount: order.final_payable_amount,
      p_gateway_event_id: `callback_${razorpay_payment_id}`,
      p_gateway_event_created_at: new Date().toISOString(),
      p_webhook_event_id: null,
      p_gateway_payload: {
        source: 'browser_checkout_callback',
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      },
    });

    if (confirmErr || !confirmation) {
      console.error('Database confirmation error:', confirmErr);
      return NextResponse.json(
        { success: false, error: `Order confirmation failed: ${confirmErr?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: confirmation,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Error verifying payment signature:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
