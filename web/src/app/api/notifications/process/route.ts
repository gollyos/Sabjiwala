import { getErrorMessage } from '@/lib/errors';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formatBilingualOrderConfirmed, formatBilingualOutForDelivery, formatBilingualOrderDelivered, formatBilingualDeliveryFailed, formatOwnerProcurementReport, formatOwnerOperationalAlert, sendWhatsAppMessage } from '@/lib/whatsapp';
function secretsMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
  try {
    // Require a dedicated worker secret for n8n / cron triggers.
    const authHeader = req.headers.get('authorization');
    const secretHeader = req.headers.get('x-internal-secret');
    const expectedSecret = process.env.INTERNAL_WORKER_SECRET;
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const receivedSecret = secretHeader || bearerSecret || '';
    let isAuthorized = Boolean(expectedSecret && secretsMatch(receivedSecret, expectedSecret));

    if (!isAuthorized) {
      const sessionClient = await createClient();
      const { data: { user } } = await sessionClient.auth.getUser();
      if (user) {
        const { data: roles } = await sessionClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        isAuthorized = roles?.some(({ role }) => role === 'owner' || role === 'manager') || false;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized worker request.' },
        { status: 401 }
      );
    }

    // Do not initialize privileged database access until authorization passes.
    const supabase = createAdminClient();

    const body = await req.json().catch(() => ({}));
    const specificJobId = body.job_id;

    if (specificJobId !== undefined && (
      typeof specificJobId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(specificJobId)
    )) {
      return NextResponse.json({ success: false, error: 'job_id must be a valid UUID.' }, { status: 400 });
    }

    // Fetch config & PWA URL from app_settings
    const { data: configRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'whatsapp_config')
      .single();

    const config = configRow?.value || {};
    const pwaBaseUrl = config.pwa_base_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://taazatokra.com';

    const jobId = typeof specificJobId === 'string' ? specificJobId : null;
    const { data: jobs, error: fetchErr } = await supabase.rpc('claim_notification_jobs', {
      p_limit: jobId ? 1 : 20,
      p_job_id: jobId,
    });

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No queued notifications found' });
    }

    const results = [];

    for (const job of jobs) {
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

        results.push({ id: job.id, status: 'sent', messageId: sendResult.messageId });
      } else {
        const nextRetry = job.retry_count + 1;
        const finalStatus = nextRetry >= job.max_retries ? 'failed' : 'queued';

        await supabase
          .from('notification_jobs')
          .update({
            status: finalStatus,
            retry_count: nextRetry,
            last_error: sendResult.error,
            scheduled_at: new Date(Date.now() + Math.min(2 ** nextRetry, 60) * 60_000).toISOString(),
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
  } catch (err) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(err) || 'Notification processing exception' },
      { status: 500 }
    );
  }
}
