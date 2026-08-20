import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchN8nOrderWebhook } from '@/lib/n8n';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { order_id, is_test, test_webhook_url } = body;

    // If test trigger from settings page
    if (is_test && test_webhook_url) {
      let webhookUrl: URL;
      try {
        webhookUrl = new URL(test_webhook_url);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Enter a valid public HTTPS webhook URL.' },
          { status: 400 }
        );
      }
      const blockedHost = /^(localhost|\[::1\]|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(webhookUrl.hostname);
      if (webhookUrl.protocol !== 'https:' || blockedHost) {
        return NextResponse.json(
          { success: false, error: 'Test webhook must use a public HTTPS URL.' },
          { status: 400 }
        );
      }

      const testPayload = {
        event: 'TEST_EVENT',
        timestamp: new Date().toISOString(),
        source: 'taazatokra_settings_test',
        message: '✅ TaazaTokra & n8n webhook connection verified successfully!',
        sample_order: {
          order_number: 'SBJ-SAMPLE-2026',
          customer_name: 'Test Customer (ટેસ્ટ ગ્રાહક)',
          customer_mobile: '+910000000000',
          delivery_date: new Date().toISOString().split('T')[0],
          delivery_slot: '10:00 AM – 01:00 PM',
          delivery_area: 'Pavagadh Bypass, Halol',
          final_payable_amount: 250.00,
          payment_method: 'COD',
          items_summary_text: '2x ટામેટા (1 kg), 1x બટાટા (2 kg)',
        },
      };

      const res = await fetch(webhookUrl, {
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
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Error in n8n trigger route';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
