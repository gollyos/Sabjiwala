import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const raw = String(val);
  const str = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedType = searchParams.get('type') || 'orders';
    const validTypes = new Set(['orders', 'products', 'customers', 'suppliers', 'procurement', 'delivery', 'sales']);
    if (!validTypes.has(requestedType)) {
      return NextResponse.json({ success: false, error: 'Unsupported report type.' }, { status: 400 });
    }
    const type = requestedType;
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    const supabase = getServiceSupabase();
    let csvHeader = '';
    let csvRows: string[] = [];
    const filename = `taazatokra_${type}_${startDate}_to_${endDate}.csv`;

    if (type === 'orders') {
      const { data } = await supabase.rpc('get_detailed_orders_report', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_status: searchParams.get('status') || null,
        p_area: searchParams.get('area') || null,
        p_search: searchParams.get('search') || null,
        p_limit: 10000,
        p_offset: 0,
      });

      csvHeader = 'Order Number,Delivery Date,Customer Name,Mobile,Area,Address,Order Status,Payment Status,Payment Method,Subtotal (₹),FIRST500 (₹),COD Disc (₹),Final Payable (₹),Items Summary';
      const orders = data?.orders || [];
      csvRows = (orders as Array<Record<string, unknown>>).map((o) => {
        const address = `${o.delivery_flat_house_snapshot || ''}, ${o.delivery_society_street_snapshot || ''}, ${o.delivery_landmark_snapshot || ''}`.trim();
        const items = (o.items as Array<Record<string, unknown>> | undefined) || [];
        const itemsSummary = items.map((item) => `${item.product_name_en} (${item.quantity}x ${item.variant_name_en})`).join('; ');
        return [
          escapeCsv(o.order_number),
          escapeCsv(o.delivery_date),
          escapeCsv(o.customer_name_snapshot),
          escapeCsv(o.customer_mobile_snapshot),
          escapeCsv(o.delivery_area_snapshot),
          escapeCsv(address),
          escapeCsv(o.order_status),
          escapeCsv(o.payment_status),
          escapeCsv(o.payment_method),
          escapeCsv(o.subtotal_amount),
          escapeCsv(o.first500_discount_amount),
          escapeCsv(o.cod_discount_amount),
          escapeCsv(o.final_payable_amount),
          escapeCsv(itemsSummary),
        ].join(',');
      });
    } else if (type === 'products') {
      const { data } = await supabase.rpc('get_product_reporting_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_category_id: searchParams.get('category_id') || null,
        p_product_id: null,
      });

      csvHeader = 'Product Name (EN),Product Name (GU),Category,Base Unit,Quantity Sold,Total Orders,Net Sales (₹),Estimated Cost (₹),Gross Contribution (₹),Avg Selling Price (₹),Avg Cost (₹),Margin (%)';
      const prods = data?.products || [];
      csvRows = (prods as Array<Record<string, unknown>>).map((p) => [
        escapeCsv(p.name_en),
        escapeCsv(p.name_gu),
        escapeCsv(p.category_name_en),
        escapeCsv(p.base_unit),
        escapeCsv(p.total_quantity_sold),
        escapeCsv(p.total_orders),
        escapeCsv(p.net_sales),
        escapeCsv(p.estimated_procurement_cost),
        escapeCsv(p.gross_contribution),
        escapeCsv(Number(p.average_selling_price).toFixed(2)),
        escapeCsv(Number(p.average_cost).toFixed(2)),
        escapeCsv(Number(p.margin_percentage).toFixed(2)),
      ].join(','));
    } else if (type === 'customers') {
      const { data } = await supabase.rpc('get_customer_reporting_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: 10000,
        p_offset: 0,
      });

      csvHeader = 'Customer Name,Mobile,Sequence No,Registered On,Total Orders,Lifetime Spend (₹),AOV (₹),Last Order Date,FIRST500 Used';
      const custs = data?.customers || [];
      csvRows = (custs as Array<Record<string, unknown>>).map((c) => [
        escapeCsv(c.full_name),
        escapeCsv(c.mobile),
        escapeCsv(c.verified_sequence),
        escapeCsv(
          typeof c.registration_date === 'string' || typeof c.registration_date === 'number'
            ? new Date(c.registration_date).toLocaleDateString('en-IN')
            : ''
        ),
        escapeCsv(c.total_orders),
        escapeCsv(c.lifetime_spend),
        escapeCsv(Number(c.average_order_value).toFixed(2)),
        escapeCsv(c.last_order_date || 'None'),
        escapeCsv(c.first500_consumed ? 'Yes' : 'No'),
      ].join(','));
    } else if (type === 'suppliers') {
      const { data } = await supabase.rpc('get_supplier_reporting_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      csvHeader = 'Supplier Name,Contact Person,Mobile,APMC Location,Total Batches,Purchased Qty,Purchase Value (₹),Wastage Qty,Average Rate (₹),Last Purchase Date';
      const supps = data?.suppliers || [];
      csvRows = (supps as Array<Record<string, unknown>>).map((s) => [
        escapeCsv(s.supplier_name),
        escapeCsv(s.contact_person),
        escapeCsv(s.mobile),
        escapeCsv(s.apmc_market_location),
        escapeCsv(s.total_batches),
        escapeCsv(s.total_quantity_purchased),
        escapeCsv(s.total_purchase_value),
        escapeCsv(s.total_wastage_quantity),
        escapeCsv(Number(s.average_rate).toFixed(2)),
        escapeCsv(s.last_purchase_date || ''),
      ].join(','));
    } else if (type === 'procurement') {
      const { data } = await supabase.rpc('get_procurement_reporting_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_batch_id: searchParams.get('batch_id') || null,
      });

      csvHeader = 'Batch Number,Delivery Date,Product Name (EN),Product Name (GU),Unit,Demand Qty,Required Qty,Purchased Qty,Received Qty,Usable Qty,Wastage Qty,Purchase Rate (₹),Total Cost (₹),Supplier';
      const items = data?.items || [];
      csvRows = (items as Array<Record<string, unknown>>).map((it) => [
        escapeCsv(it.batch_number),
        escapeCsv(it.delivery_date),
        escapeCsv(it.name_en),
        escapeCsv(it.name_gu),
        escapeCsv(it.unit_code),
        escapeCsv(it.total_demand_quantity),
        escapeCsv(it.total_required_quantity),
        escapeCsv(it.purchased_quantity),
        escapeCsv(it.received_quantity),
        escapeCsv(it.usable_quantity),
        escapeCsv(it.wastage_quantity),
        escapeCsv(it.actual_purchase_rate),
        escapeCsv(it.total_line_cost),
        escapeCsv(it.supplier_name || 'Mandi Spot'),
      ].join(','));
    } else if (type === 'delivery') {
      const { data } = await supabase.rpc('get_delivery_reporting_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_driver_id: searchParams.get('driver_id') || null,
      });

      csvHeader = 'Driver Name,Assigned Deliveries,Completed,Failed,COD Expected (₹),COD Collected (₹),Cash Collected (₹),UPI Collected (₹)';
      const drivers = data?.driver_performance || [];
      csvRows = (drivers as Array<Record<string, unknown>>).map((d) => [
        escapeCsv(d.driver_name),
        escapeCsv(d.total_assigned),
        escapeCsv(d.completed_deliveries),
        escapeCsv(d.failed_deliveries),
        escapeCsv(d.cod_collected),
        escapeCsv(d.cod_collected),
        escapeCsv(d.cash_collected),
        escapeCsv(d.upi_collected),
      ].join(','));
    } else if (type === 'sales') {
      const { data } = await supabase.rpc('get_sales_financial_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      csvHeader = 'Date,Gross Sales (GMV ₹),FIRST500 Disc (₹),COD Disc (₹),Net Revenue (₹)';
      const breakdown = data?.daily_breakdown || [];
      csvRows = (breakdown as Array<Record<string, unknown>>).map((b) => [
        escapeCsv(b.delivery_date),
        escapeCsv(b.gross_sales),
        escapeCsv(b.first500_discount),
        escapeCsv(b.cod_discount),
        escapeCsv(b.net_revenue),
      ].join(','));
    }

    const csvContent = '\uFEFF' + [csvHeader, ...csvRows].join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
