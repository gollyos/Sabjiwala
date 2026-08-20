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
  try {
    const supabase = getServiceSupabase();

    const { data: batches, error } = await supabase
      .from('procurement_batches')
      .select('*')
      .order('batch_date', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: batches });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
