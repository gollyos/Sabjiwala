import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { RazorpayService } from '@/lib/razorpay';
import { createAdminClient } from '@/lib/supabase/admin';
export async function POST(req: NextRequest) {
  let rawBody = '';
  let eventId = '';
  let signature = '';

  try {
    const supabase = createAdminClient();
    // 1. Read RAW request body (Preserve raw format for cryptographic HMAC verification)
    rawBody = await req.text();
    signature = req.headers.get('x-razorpay-signature') || '';
    eventId = req.headers.get('x-razorpay-event-id') || '';

    if (!signature) {
      console.warn('[WEBHOOK SECURITY] Missing x-razorpay-signature header');
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ error: 'Missing webhook event ID' }, { status: 400 });
    }

    // 2. Cryptographic Webhook Signature Verification
    const isValid = RazorpayService.verifyWebhookSignature({
      rawBody,
      signature,
    });

    if (!isValid) {
      console.warn(`[WEBHOOK SECURITY] Invalid Razorpay webhook signature for event: ${eventId}`);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    // 3. Parse Payload
    const payload = JSON.parse(rawBody);
    const eventType: string = payload.event;
    const topLevelCreatedAt: number = payload.created_at || Math.floor(Date.now() / 1000);
    const gatewayEventCreatedAt = new Date(topLevelCreatedAt * 1000).toISOString();

    // 4. Idempotency Check & Ingestion in payment_webhook_events
    const { data: existingEvent } = await supabase
      .from('payment_webhook_events')
      .select('id, processed_status')
      .eq('gateway_provider', 'razorpay')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      if (existingEvent.processed_status === 'processed') {
        // Idempotent duplicate: already successfully processed
        return NextResponse.json({ received: true, duplicate: true, status: 'already_processed' }, { status: 200 });
      }
    }

    // Insert or get webhook event record
    let webhookRecordId: string | null = existingEvent ? existingEvent.id : null;
    if (!existingEvent) {
      const { data: insertedEvent, error: insertErr } = await supabase
        .from('payment_webhook_events')
        .insert({
          gateway_provider: 'razorpay',
          event_id: eventId,
          event_type: eventType,
          payload,
          processed_status: 'pending',
        })
        .select('id')
        .single();

      if (!insertErr && insertedEvent) {
        webhookRecordId = insertedEvent.id;
      } else if (insertErr) {
        console.error('[WEBHOOK] Failed to persist idempotency record:', insertErr);
        return NextResponse.json({ error: 'Unable to persist webhook event' }, { status: 500 });
      }
    }

    // 5. Handle Event Types
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity || payload.payload?.order?.entity;
      const notes = paymentEntity?.notes || {};
      const internalOrderId = notes.order_id;
      const razorpayOrderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id || '';
      const razorpayPaymentId = paymentEntity?.id || '';
      const amountPaise = Number(paymentEntity?.amount || 0);
      const paymentAmount = amountPaise > 0 ? Number((amountPaise / 100).toFixed(2)) : null;

      if (!internalOrderId) {
        // Try looking up order by razorpay_order_id in orders or notes
        console.warn(`[WEBHOOK] Missing internal order_id in notes for event ${eventId}`);
        if (webhookRecordId) {
          await supabase
            .from('payment_webhook_events')
            .update({ processed_status: 'ignored', processing_error: 'Missing internal order_id' })
            .eq('id', webhookRecordId);
        }
        return NextResponse.json({ received: true, ignored: true, reason: 'No order_id in notes' });
      }

      // Execute atomic confirmation transaction via RPC
      const { data: result, error: rpcErr } = await supabase.rpc('confirm_online_payment_capture', {
        p_order_id: internalOrderId,
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
        p_payment_amount: paymentAmount,
        p_gateway_event_id: eventId,
        p_gateway_event_created_at: gatewayEventCreatedAt,
        p_webhook_event_id: webhookRecordId,
        p_gateway_payload: payload,
      });

      if (rpcErr) {
        console.error(`[WEBHOOK ERROR] Error executing confirm_online_payment_capture for order ${internalOrderId}:`, rpcErr);
        if (webhookRecordId) {
          await supabase
            .from('payment_webhook_events')
            .update({ processed_status: 'failed', processing_error: rpcErr.message })
            .eq('id', webhookRecordId);
        }
        return NextResponse.json({ received: true, error: rpcErr.message }, { status: 500 });
      }


      if (razorpayOrderId) {
        await supabase
          .from('payment_gateway_attempts')
          .update({ status: 'captured', updated_at: new Date().toISOString() })
          .eq('gateway_order_id', razorpayOrderId);
      }

      return NextResponse.json({ received: true, success: true, result });
    }

    if (eventType === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const notes = paymentEntity?.notes || {};
      const internalOrderId = notes.order_id;
      const razorpayOrderId = paymentEntity?.order_id || '';
      const razorpayPaymentId = paymentEntity?.id || '';
      const errorCode = paymentEntity?.error_code || 'PAYMENT_FAILED';
      const errorDesc = paymentEntity?.error_description || 'Customer payment failed';

      if (internalOrderId) {
        await supabase.rpc('record_online_payment_failure', {
          p_order_id: internalOrderId,
          p_razorpay_order_id: razorpayOrderId,
          p_razorpay_payment_id: razorpayPaymentId,
          p_error_code: errorCode,
          p_error_description: errorDesc,
          p_webhook_event_id: webhookRecordId,
          p_gateway_payload: payload,
        });

        if (razorpayOrderId) {
          await supabase
            .from('payment_gateway_attempts')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('gateway_order_id', razorpayOrderId);
        }
      }

      return NextResponse.json({ received: true, status: 'payment_failed_recorded' });
    }

    // Default: Mark other events as processed/ignored safely
    if (webhookRecordId) {
      await supabase
        .from('payment_webhook_events')
        .update({ processed_status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', webhookRecordId);
    }

    return NextResponse.json({ received: true, event: eventType, status: 'acknowledged' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Unknown webhook error';
    console.error('[WEBHOOK UNCAUGHT EXCEPTION]:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
