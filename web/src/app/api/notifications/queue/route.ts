import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('notification_jobs')
      .select('*', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (type && type !== 'all') {
      query = query.eq('notification_type', type);
    }

    if (search) {
      query = query.or(`recipient.ilike.%${search}%,template_key.ilike.%${search}%,idempotency_key.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: jobs, count, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Counts by status
    const { data: statusStats } = await supabase
      .from('notification_jobs')
      .select('status');

    const counts = {
      total: statusStats?.length || 0,
      queued: statusStats?.filter((j) => j.status === 'queued').length || 0,
      processing: statusStats?.filter((j) => j.status === 'processing').length || 0,
      sent: statusStats?.filter((j) => j.status === 'sent').length || 0,
      failed: statusStats?.filter((j) => j.status === 'failed').length || 0,
    };

    return NextResponse.json({
      success: true,
      counts,
      total_count: count || 0,
      jobs: jobs || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error fetching notifications queue' },
      { status: 500 }
    );
  }
}
