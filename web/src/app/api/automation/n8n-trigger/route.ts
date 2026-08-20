import { NextRequest, NextResponse } from 'next/server';
import { dispatchN8nOrderWebhook } from '@/lib/n8n';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { order_id, is_test, test_webhook_url } = body;

    // If test trigger from settings page
    if (is_test && test_webhook_url) {
      const testPayload = {
        event: 'TEST_EVENT',
        timestamp: new Date().toISOString(),
        source: 'sabjiwala_settings_test',
        message: '✅ Sabjiwala & n8n Webhook connection verified successfully!',
        sample_order: {
          order_number: 'SBJ-SAMPLE-2026',
          customer_name: 'Test Customer (ટેસ્ટ ગ્રાહક)',
          customer_mobile: '+919876543210',
          delivery_date: new Date().toISOString().split('T')[0],
          delivery_slot: '10:00 AM – 01:00 PM',
          delivery_area: 'Pavagadh Bypass, Halol',
          final_payable_amount: 250.00,
          payment_method: 'COD',
          items_summary_text: '2x ટામેટા (1 kg), 1x બટાટા (2 kg)',
        },
      };

      const res = await fetch(test_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return NextResponse.json({
          success: false,
          error: `n8n returned status ${res.status}: ${await res.text().catch(() => '')}`,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'n8n test webhook triggered and responded successfully!',
      });
    }

    if (!order_id) {
      return NextResponse.json({ success: false, error: 'Missing order_id' }, { status: 400 });
    }

    // Dispatch real order to n8n
    const result = await dispatchN8nOrderWebhook(order_id, 'ORDER_CREATED');

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error in n8n trigger route';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
