import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { data, error } = await supabase
      .from('procurement_purchase_lines')
      .select(`
        id,
        procurement_item_id,
        supplier_id,
        supplier_name,
        purchased_qty,
        rate_per_unit,
        total_cost,
        mandi_lot_or_bill_no,
        notes,
        created_at,
        procurement_items (
          id,
          product_id,
          products (
            id,
            name_en,
            name_gu,
            image_url,
            category_id,
            categories (
              name_en
            )
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Error fetching purchases';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json().catch(() => ({}));
    const {
      product_id,
      product_name,
      purchased_qty,
      unit_code,
      rate_per_unit,
      total_cost,
      supplier_name,
      mandi_lot_or_bill_no,
      purchase_date,
      notes,
    } = body;

    const qty = parseFloat(purchased_qty);
    const rate = parseFloat(rate_per_unit);
    const calculatedTotal = total_cost ? parseFloat(total_cost) : (qty * rate);

    if (!product_id || isNaN(qty) || qty <= 0 || isNaN(rate) || rate < 0) {
      return NextResponse.json(
        { success: false, error: 'Product ID, valid quantity (>0), and rate per unit are required.' },
        { status: 400 }
      );
    }

    // 1. Get or create today's procurement batch for this purchase
    const todayStr = purchase_date || new Date().toISOString().split('T')[0];
    
    let { data: batch } = await supabase
      .from('procurement_batches')
      .select('id')
      .eq('batch_date', todayStr)
      .maybeSingle();

    if (!batch) {
      const { data: newBatch, error: batchErr } = await supabase
        .from('procurement_batches')
        .insert({
          batch_number: `BATCH-${todayStr.replace(/-/g, '')}-01`,
          batch_date: todayStr,
          status: 'open',
        })
        .select('id')
        .single();

      if (batchErr) {
        // Fallback: search any recent batch
        const { data: fallbackBatch } = await supabase
          .from('procurement_batches')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        batch = fallbackBatch;
      } else {
        batch = newBatch;
      }
    }

    const batchId = batch?.id;

    // 2. Get or create procurement item row for this product in the batch
    let procurementItemId = null;
    if (batchId) {
      const { data: pItem } = await supabase
        .from('procurement_items')
        .select('id')
        .eq('batch_id', batchId)
        .eq('product_id', product_id)
        .maybeSingle();

      if (pItem) {
        procurementItemId = pItem.id;
      } else {
        const { data: newPItem } = await supabase
          .from('procurement_items')
          .insert({
            batch_id: batchId,
            product_id: product_id,
            required_qty: qty,
            suggested_procurement_qty: qty,
            procured_qty: qty,
            latest_mandi_rate: rate,
            total_procurement_cost: calculatedTotal,
          })
          .select('id')
          .single();
        procurementItemId = newPItem?.id;
      }
    }

    // 3. Insert into procurement_purchase_lines
    const { data: purchaseLine, error: insertErr } = await supabase
      .from('procurement_purchase_lines')
      .insert({
        procurement_item_id: procurementItemId,
        supplier_name: supplier_name || 'Halol APMC Mandi',
        purchased_qty: qty,
        rate_per_unit: rate,
        total_cost: calculatedTotal,
        mandi_lot_or_bill_no: mandi_lot_or_bill_no || null,
        notes: notes || `Direct entry for ${product_name || 'produce'} (${qty} ${unit_code || 'kg'} @ ₹${rate})`,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Error inserting purchase line:', insertErr);
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: purchaseLine,
      message: `Purchase of ${qty} ${unit_code || 'kg'} at ₹${rate}/kg logged successfully.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Error saving purchase entry';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
