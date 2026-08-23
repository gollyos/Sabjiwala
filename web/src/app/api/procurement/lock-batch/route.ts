import crypto from 'node:crypto';
import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

function secretsMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const serviceSupabase = getServiceSupabase();
    let actorId: string | null = null;
    let isAuthorized = false;

    // 1. Check Secret Header (for automated n8n / cron trigger)
    const secretHeader = req.headers.get('x-procurement-secret');
    if (secretHeader) {
      const { data: settingData } = await serviceSupabase
        .from('app_settings')
        .select('value')
        .eq('key', 'procurement_lock_secret')
        .single();

      const validSecret = settingData?.value?.secret || process.env.PROCUREMENT_LOCK_SECRET;
      if (validSecret && secretsMatch(secretHeader, validSecret)) {
        isAuthorized = true;
      }
    }

    // 2. If no valid secret header, check Owner / Manager session cookie
    if (!isAuthorized) {
      const supabase = await createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();

      if (!authErr && user) {
        // Verify staff role
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const roles = (userRoles || []).map(r => r.role);
        if (roles.includes('owner') || roles.includes('manager')) {
          isAuthorized = true;
          actorId = user.id;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Owner/Manager session or valid secret token required.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { target_delivery_date, cutoff_timestamp } = body;

    // 3. Execute Atomic Batch Lock RPC
    const { data: lockResult, error: lockErr } = await serviceSupabase.rpc('lock_daily_procurement_batch', {
      p_target_delivery_date: target_delivery_date || null,
      p_cutoff_timestamp: cutoff_timestamp || null,
      p_actor_id: actorId,
    });

    if (lockErr) {
      console.error('Error locking procurement batch:', lockErr);
      return NextResponse.json(
        { success: false, error: `Batch lock failed: ${getErrorMessage(lockErr)}` },
        { status: 500 }
      );
    }

    if (!lockResult?.success && lockResult?.error_code === 'NO_ELIGIBLE_ORDERS') {
      return NextResponse.json(
        { 
          success: false, 
          error_code: 'NO_ELIGIBLE_ORDERS',
          message: lockResult.message,
          target_delivery_date: lockResult.target_delivery_date,
          cutoff_timestamp: lockResult.cutoff_timestamp
        },
        { status: 200 }
      );
    }

    // 4. Fetch Full Batch Details for Complete Owner Report Payload
    const batchId = lockResult.batch_id;
    const { data: batchDetails } = await serviceSupabase.rpc('get_procurement_batch_details', {
      p_batch_id: batchId,
    });

    return NextResponse.json({
      success: true,
      data: {
        lock_status: lockResult,
        report: batchDetails,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    console.error('Unexpected error locking procurement batch:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
