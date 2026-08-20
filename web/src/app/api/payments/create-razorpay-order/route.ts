import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RazorpayService } from '@/lib/razorpay';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: order_id' },
        { status: 400 }
      );
    }

    // 1. Fetch internal order record (Must belong to authenticated customer and be payment_pending)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, final_payable_amount, order_status, payment_status, customers!inner(auth_user_id, full_name, mobile, email)')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found or access denied.' },
        { status: 404 }
      );
    }

    const customerData = order.customers as unknown as {
      auth_user_id: string;
      full_name: string;
      mobile: string;
      email?: string;
    };

    if (customerData.auth_user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have permission to pay for this order.' },
        { status: 403 }
      );
    }

    if (order.order_status !== 'payment_pending') {
      return NextResponse.json(
        { success: false, error: `Order is not awaiting payment (status: ${order.order_status}).` },
        { status: 400 }
      );
    }

    // 2. Authoritative Amount in smallest currency unit (paise)
    const amountPaise = Math.round(Number(order.final_payable_amount) * 100);

    if (amountPaise <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid order payable amount.' },
        { status: 400 }
      );
    }

    // 3. Create Razorpay Order via Server
    const rzpOrder = await RazorpayService.createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt: order.order_number,
      notes: {
        order_id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
      },
    });

    const admin = createAdminClient();
    const { error: attemptError } = await admin
      .from('payment_gateway_attempts')
      .insert({
        order_id: order.id,
        customer_id: order.customer_id,
        provider: 'razorpay',
        gateway_order_id: rzpOrder.id,
        amount_paise: amountPaise,
        currency: 'INR',
        status: 'created',
      });

    if (attemptError) {
      console.error('Unable to persist Razorpay payment attempt:', attemptError);
      return NextResponse.json(
        { success: false, error: 'Payment initialization could not be recorded. Please retry.' },
        { status: 503 }
      );
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_sabjiwala_mock';

    return NextResponse.json({
      success: true,
      razorpay_order_id: rzpOrder.id,
      amount: order.final_payable_amount,
      amount_paise: amountPaise,
      currency: 'INR',
      order_number: order.order_number,
      order_id: order.id,
      key_id: keyId,
      customer_prefill: {
        name: customerData.full_name,
        contact: customerData.mobile,
        email: customerData.email || `${customerData.mobile.replace(/\D/g, '')}@sabjiwala.app`,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    console.error('Error creating Razorpay order:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
