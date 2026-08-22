import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { todayIST } from '@/lib/istDate';

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
      supplier_name,
      mandi_lot_or_bill_no,
      purchase_date,
      notes,
    } = body;

    const qty = parseFloat(purchased_qty);
    const rate = parseFloat(rate_per_unit);
    // Money is always computed server-side; a client-sent total is never trusted.
    const calculatedTotal = Math.round(qty * rate * 100) / 100;

    if (!product_id || isNaN(qty) || qty <= 0 || isNaN(rate) || rate < 0) {
      return NextResponse.json(
        { success: false, error: 'Product ID, valid quantity (>0), and rate per unit are required.' },
        { status: 400 }
      );
    }

    // 1. Get or create the procurement batch for the purchase date (IST day).
    const todayStr = purchase_date || todayIST();
    if (typeof todayStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(todayStr)) {
      return NextResponse.json(
        { success: false, error: 'purchase_date must be a valid date (YYYY-MM-DD).' },
        { status: 400 }
      );
    }

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
        // Most insert failures here are a unique-constraint race (another
        // request created the same-date batch first). Re-read the same date
        // once; NEVER fall back to a different date's batch, or the purchase
        // is silently attributed to the wrong day.
        const { data: raceBatch } = await supabase
          .from('procurement_batches')
          .select('id')
          .eq('batch_date', todayStr)
          .maybeSingle();
        batch = raceBatch;
      } else {
        batch = newBatch;
      }
    }

    if (!batch?.id) {
      return NextResponse.json(
        { success: false, error: `Could not resolve the procurement batch for ${todayStr}. Please retry.` },
        { status: 502 }
      );
    }

    // 2. Get or create procurement item row for this product in the batch
    let procurementItemId: string | null = null;
    const { data: pItem } = await supabase
      .from('procurement_items')
      .select('id')
      .eq('batch_id', batch.id)
      .eq('product_id', product_id)
      .maybeSingle();

    if (pItem) {
      procurementItemId = pItem.id;
    } else {
      const { data: newPItem, error: pItemErr } = await supabase
        .from('procurement_items')
        .insert({
          batch_id: batch.id,
          product_id: product_id,
          required_qty: qty,
          suggested_procurement_qty: qty,
          procured_qty: qty,
          latest_mandi_rate: rate,
          total_procurement_cost: calculatedTotal,
        })
        .select('id')
        .single();
      if (pItemErr || !newPItem?.id) {
        return NextResponse.json(
          { success: false, error: pItemErr?.message || 'Failed to create procurement item for this purchase.' },
          { status: 500 }
        );
      }
      procurementItemId = newPItem.id;
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

    // 4. Recalculate item + batch totals from the purchase lines (mirrors
    // record_procurement_purchase_line) so dashboards stay consistent when a
    // product is purchased more than once in the same batch.
    const { data: itemTotals } = await supabase
      .from('procurement_purchase_lines')
      .select('purchased_qty, total_cost')
      .eq('procurement_item_id', procurementItemId);

    const totals = (itemTotals || []).reduce(
      (acc, line) => {
        acc.qty += Number(line.purchased_qty) || 0;
        acc.cost += Number(line.total_cost) || 0;
        return acc;
      },
      { qty: 0, cost: 0 }
    );

    await supabase
      .from('procurement_items')
      .update({
        procured_qty: Math.round(totals.qty * 1000) / 1000,
        total_procurement_cost: Math.round(totals.cost * 100) / 100,
        latest_mandi_rate: rate,
      })
      .eq('id', procurementItemId);

    const { data: batchItems } = await supabase
      .from('procurement_items')
      .select('total_procurement_cost')
      .eq('batch_id', batch.id);

    const batchTotal = (batchItems || []).reduce(
      (sum, item) => sum + (Number(item.total_procurement_cost) || 0),
      0
    );

    await supabase
      .from('procurement_batches')
      .update({ total_procurement_cost: Math.round(batchTotal * 100) / 100 })
      .eq('id', batch.id);

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
