import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.');
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Staff authentication required' },
        { status: 401 }
      );
    }

    const { data: roleRows } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (roleRows || []).map((r) => r.role);
    const isAuthorized = roles.includes('manager') || roles.includes('owner');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient privileges' },
        { status: 403 }
      );
    }

    const supabase = getServiceSupabase();
    const body = await req.json().catch(() => ({}));
    const { job_id, retry_all_failed } = body;

    if (retry_all_failed) {
      const { data, error } = await supabase
        .from('notification_jobs')
        .update({
          status: 'queued',
          retry_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'failed')
        .select('id');

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Reset ${data?.length || 0} failed notification jobs to queued`,
      });
    }

    if (!job_id) {
      return NextResponse.json({ success: false, error: 'job_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notification_jobs')
      .update({
        status: 'queued',
        retry_count: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job_id)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Notification job reset to queued for retry',
      job_id: data.id,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(err) || 'Error retrying notification' },
      { status: 500 }
    );
  }
}
