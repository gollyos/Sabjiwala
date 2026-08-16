import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      procurement_item_id,
      supplier_id,
      purchased_qty,
      rate_per_unit,
      mandi_lot_or_bill_no,
      notes,
      purchased_by,
    } = body;

    if (!procurement_item_id || !purchased_qty || rate_per_unit === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters (procurement_item_id, purchased_qty, rate_per_unit)' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: result, error } = await supabase.rpc('record_procurement_purchase_line', {
      p_procurement_item_id: procurement_item_id,
      p_supplier_id: supplier_id || null,
      p_purchased_qty: Number(purchased_qty),
      p_rate_per_unit: Number(rate_per_unit),
      p_mandi_lot_or_bill_no: mandi_lot_or_bill_no || null,
      p_notes: notes || null,
      p_purchased_by: purchased_by || null,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
