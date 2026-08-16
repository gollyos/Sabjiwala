import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { 
  formatBilingualOrderConfirmed,
  formatBilingualOutForDelivery,
  formatBilingualOrderDelivered,
  formatBilingualDeliveryFailed,
  formatOwnerProcurementReport,
  formatOwnerOperationalAlert,
  sendWhatsAppMessage
} from '@/lib/whatsapp';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    // Check optional worker secret for secure n8n / cron trigger
    const authHeader = req.headers.get('authorization');
    const secretHeader = req.headers.get('x-internal-secret');
    const expectedSecret = process.env.INTERNAL_WORKER_SECRET || 'sabjiwala_worker_secret_2026';

    const body = await req.json().catch(() => ({}));
    const specificJobId = body.job_id;

    // Fetch config & PWA URL from app_settings
    const { data: configRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'whatsapp_config')
      .single();

    const config = configRow?.value || {};
    const pwaBaseUrl = config.pwa_base_url || 'https://sabjiwala.store';

    // Fetch pending jobs
    let query = supabase
      .from('notification_jobs')
      .select('*')
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: true })
      .limit(20);

    if (specificJobId) {
      query = supabase
        .from('notification_jobs')
        .select('*')
        .eq('id', specificJobId);
    }

    const { data: jobs, error: fetchErr } = await query;

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No queued notifications found' });
    }

    const results = [];

    for (const job of jobs) {
      // Mark as processing
      await supabase
        .from('notification_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', job.id);

      let textMessage = '';

      switch (job.notification_type) {
        case 'ORDER_CONFIRMED':
          textMessage = formatBilingualOrderConfirmed(job.payload, pwaBaseUrl);
          break;
        case 'OUT_FOR_DELIVERY':
          textMessage = formatBilingualOutForDelivery(job.payload, pwaBaseUrl);
          break;
        case 'ORDER_DELIVERED':
          textMessage = formatBilingualOrderDelivered(job.payload, pwaBaseUrl);
          break;
        case 'DELIVERY_FAILED':
          textMessage = formatBilingualDeliveryFailed(job.payload, pwaBaseUrl);
          break;
        case 'PROCUREMENT_BATCH_LOCKED':
          textMessage = formatOwnerProcurementReport(job.payload, pwaBaseUrl);
          break;
        case 'PACKING_PROBLEM':
        case 'COD_DISCREPANCY':
        case 'OWNER_OPERATIONAL_ALERT':
          textMessage = formatOwnerOperationalAlert(job.notification_type, job.payload, pwaBaseUrl);
          break;
        default:
          textMessage = `*Sabjiwala Alert:* ${JSON.stringify(job.payload)}`;
          break;
      }

      // Send WhatsApp message
      const sendResult = await sendWhatsAppMessage(job.recipient, textMessage, config);

      if (sendResult.success) {
        await supabase
          .from('notification_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            whatsapp_message_id: sendResult.messageId,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        results.push({ id: job.id, status: 'sent', recipient: job.recipient, messageId: sendResult.messageId });
      } else {
        const nextRetry = job.retry_count + 1;
        const finalStatus = nextRetry >= job.max_retries ? 'failed' : 'queued';

        await supabase
          .from('notification_jobs')
          .update({
            status: finalStatus,
            retry_count: nextRetry,
            last_error: sendResult.error,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        results.push({ id: job.id, status: finalStatus, error: sendResult.error, retry_count: nextRetry });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Notification processing exception' },
      { status: 500 }
    );
  }
}
