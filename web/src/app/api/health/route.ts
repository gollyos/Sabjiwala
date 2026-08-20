import { getErrorMessage } from '@/lib/errors';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.');
  return createSupabaseClient(url, key);
}

export async function GET() {
  const startTime = Date.now();
  try {
    const supabase = getServiceSupabase();

    // 1. Check Database Connectivity
    const { error: dbErr } = await supabase
      .from('app_settings')
      .select('key')
      .limit(1);

    const dbLatencyMs = Date.now() - startTime;

    if (dbErr) {
      return NextResponse.json(
        {
          status: 'degraded',
          release_version: 'v1.0.0',
          database: { connected: false, error: dbErr.message },
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // 2. Check Queue Health
    const { count: queuedCount } = await supabase
      .from('notification_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'queued');

    const { count: failedCount } = await supabase
      .from('notification_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed');

    return NextResponse.json({
      status: 'healthy',
      release_version: 'v1.0.0',
      service_name: 'Sabjiwala Fresh Vegetable Delivery API',
      service_area: 'Halol, Panchmahal, Gujarat (389350)',
      timezone: 'Asia/Kolkata (IST, UTC+05:30)',
      delivery_window: '10:00 AM - 1:00 PM Daily',
      cutoff_time: '20:00:00 Asia/Kolkata',
      payment_mode: 'Cash on Delivery (COD) Only (Online Payment Disabled for MVP)',
      database: {
        connected: true,
        latency_ms: dbLatencyMs,
      },
      notifications: {
        queued: queuedCount || 0,
        failed: failedCount || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        release_version: 'v1.0.0',
        error: getErrorMessage(err) || 'Health check exception',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
