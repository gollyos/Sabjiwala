import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing batch id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: details, error } = await supabase.rpc('get_procurement_batch_details', {
      p_batch_id: id,
    });

    if (error || !details) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Batch details not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: details });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
