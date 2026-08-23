import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dispatchN8nOrderWebhook } from '@/lib/n8n';

/**
 * Server-side order-confirmation notification dispatch for COD checkouts.
 *
 * Order creation itself still happens client-side via the
 * `create_customer_order` RPC (a SECURITY DEFINER Postgres function) — that
 * flow is untouched by this route. This endpoint exists only to fire the
 * n8n order-confirmation webhook immediately after a successful COD
 * checkout.
 *
 * Previously the browser called the staff-only `/api/automation/n8n-trigger`
 * endpoint directly after order placement. That endpoint requires an
 * owner/manager staff role (see the `/api/automation/` rule in
 * src/proxy.ts), so every real customer checkout got a silent 403 there and
 * the confirmation webhook never fired. This route authenticates the caller
 * instead and only allows dispatching the webhook for an order that belongs
 * to them, so a regular customer session is sufficient.
 *
 * The durable `automation_jobs` outbox (enqueued by a DB trigger on
 * `orders.order_status = 'confirmed'`, drained by
 * /api/workers/automation) remains the reliability backstop if this
 * best-effort call fails or the browser never sends it.
 */
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

    const body = await req.json().catch(() => ({}));
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: 'Missing order_id' }, { status: 400 });
    }

    // Ownership check: only the customer who placed the order may trigger
    // its confirmation notification.
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_status, customers!inner(auth_user_id)')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    const customerData = order.customers as unknown as { auth_user_id: string };
    if (customerData.auth_user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden: Access denied.' }, { status: 403 });
    }

    if (order.order_status !== 'confirmed') {
      // Nothing to notify about yet — the automation outbox will pick this
      // up once the order transitions to 'confirmed'.
      return NextResponse.json({ success: true, dispatched: false, reason: 'order_not_confirmed' });
    }

    const result = await dispatchN8nOrderWebhook(order_id, 'ORDER_CREATED');
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Error dispatching order confirmation webhook';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
