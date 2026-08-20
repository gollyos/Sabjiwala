import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchN8nOrderWebhook } from '@/lib/n8n';
import { getErrorMessage } from '@/lib/errors';

function secretsMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.INTERNAL_WORKER_SECRET;
  const authorization = request.headers.get('authorization');
  const bearerSecret = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const receivedSecret = request.headers.get('x-worker-secret') || bearerSecret;

  if (!expectedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
    return NextResponse.json({ success: false, error: 'Unauthorized worker request.' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: jobs, error: claimError } = await admin.rpc('claim_automation_jobs', { p_limit: 10 });
    if (claimError) throw claimError;

    let completed = 0;
    let failed = 0;

    for (const job of jobs || []) {
      const result = job.aggregate_type === 'order' && job.event_type === 'ORDER_CREATED'
        ? await dispatchN8nOrderWebhook(job.aggregate_id, 'ORDER_CREATED')
        : { success: false, error: 'Unsupported automation job.' };

      if (result.success) {
        completed += 1;
        await admin
          .from('automation_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      } else {
        failed += 1;
        const retryMinutes = Math.min(2 ** Number(job.attempts), 60);
        await admin
          .from('automation_jobs')
          .update({
            status: 'failed',
            last_error: result.error || 'Automation dispatch failed.',
            scheduled_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }

    return NextResponse.json({ success: true, claimed: jobs?.length || 0, completed, failed });
  } catch (error) {
    console.error('Automation worker failed:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'Automation worker failed.') },
      { status: 500 }
    );
  }
}
