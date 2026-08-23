import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RazorpayService } from '@/lib/razorpay';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchN8nOrderWebhook } from '@/lib/n8n';

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

    // 1. Fetch internal order to verify ownership and amount.
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

    const admin = createAdminClient();
    const { data: attempt, error: attemptError } = await admin
      .from('payment_gateway_attempts')
      .select('id, gateway_order_id, amount_paise, currency, status, expires_at')
      .eq('order_id', order.id)
      .eq('gateway_order_id', razorpay_order_id)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { success: false, error: 'Payment attempt was not created by this server.' },
        { status: 400 }
      );
    }

    // 2. Verify HMAC using the gateway order ID stored by our server.
    const isValidSignature = RazorpayService.verifyPaymentSignature({
      razorpay_order_id: attempt.gateway_order_id,
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

    // 3. Reconcile the signed callback against Razorpay's server API before fulfilment.
    const gatewayPayment = await RazorpayService.getPayment(razorpay_payment_id);
    const expectedPaise = Math.round(Number(order.final_payable_amount) * 100);
    const isMockPayment = process.env.NODE_ENV !== 'production' && razorpay_payment_id.includes('mock');
    const gatewayMatches = isMockPayment || (
      gatewayPayment?.status === 'captured'
      && gatewayPayment.order_id === attempt.gateway_order_id
      && gatewayPayment.amount === expectedPaise
      && gatewayPayment.amount === Number(attempt.amount_paise)
      && gatewayPayment.currency === attempt.currency
    );

    if (!gatewayMatches || !gatewayPayment) {
      return NextResponse.json(
        { success: false, error: 'Payment is not captured or does not match this order.' },
        { status: 409 }
      );
    }

    // 4. Confirm captured payment via service-only atomic RPC.
    const { data: confirmation, error: confirmErr } = await admin.rpc('confirm_online_payment_capture', {
      p_order_id: order.id,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_payment_amount: expectedPaise / 100,
      p_gateway_event_id: `callback_${razorpay_payment_id}`,
      p_gateway_event_created_at: new Date(gatewayPayment.created_at * 1000).toISOString(),
      p_webhook_event_id: null,
      p_gateway_payload: {
        source: 'browser_checkout_callback',
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        status: gatewayPayment.status,
        amount: gatewayPayment.amount,
        currency: gatewayPayment.currency,
        method: gatewayPayment.method,
      },
    });

    if (confirmErr || !confirmation) {
      console.error('Database confirmation error:', confirmErr);
      return NextResponse.json(
        { success: false, error: `Order confirmation failed: ${getErrorMessage(confirmErr)}` },
        { status: 500 }
      );
    }


    await admin
      .from('payment_gateway_attempts')
      .update({ status: 'captured', updated_at: new Date().toISOString() })
      .eq('id', attempt.id);

    // Dispatch the order-confirmation webhook server-side now that payment
    // is confirmed and ownership has already been verified above. This
    // replaces a browser-side call to the staff-only
    // /api/automation/n8n-trigger endpoint, which returned 403 for every
    // real customer and silently swallowed the failure. Best-effort: a
    // dispatch failure here must not fail the payment confirmation response
    // — the automation_jobs outbox (DB trigger + /api/workers/automation)
    // is the reliability backstop.
    try {
      const dispatchResult = await dispatchN8nOrderWebhook(order.id, 'ORDER_CREATED');
      if (!dispatchResult.success) {
        console.warn('[n8n] Order confirmation webhook dispatch failed after payment capture:', dispatchResult.error);
      }
    } catch (dispatchErr) {
      console.warn('[n8n] Order confirmation webhook dispatch threw after payment capture:', dispatchErr);
    }

    return NextResponse.json({
      success: true,
      data: confirmation,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    console.error('Error verifying payment signature:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
