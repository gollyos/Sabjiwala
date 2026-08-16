import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local if present
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim().replace(/(^"|"$|^'|'$)/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jaotajpowcgzxgpcezvi.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runOwnerReportingTests() {
  console.log('================================================================');
  console.log('🚀 SABJIWALA: OWNER REPORTING & VISUAL ANALYTICS AUTOMATED TEST');
  console.log('================================================================\n');

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Test Owner Dashboard Analytics RPC
  console.log('1. Testing get_owner_dashboard_analytics...');
  const { data: dashboardData, error: dashErr } = await supabase.rpc('get_owner_dashboard_analytics', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_compare_start_date: thirtyDaysAgo,
    p_compare_end_date: today,
  });

  if (dashErr) {
    console.error('❌ Failed get_owner_dashboard_analytics:', dashErr);
    process.exit(1);
  }
  console.log('✅ Dashboard Analytics Response received:');
  console.log(`   • Net Sales: ₹${dashboardData.kpis.total_sales}`);
  console.log(`   • Total Orders: ${dashboardData.kpis.total_orders}`);
  console.log(`   • Gross Contribution: ₹${dashboardData.kpis.gross_contribution}`);
  console.log(`   • COD Collected: ₹${dashboardData.kpis.collected_cod}`);
  console.log(`   • Top Products count: ${dashboardData.top_products.length}`);
  console.log(`   • Daily Trend points: ${dashboardData.sales_trend.length}`);

  // 2. Test Product Reporting Analytics RPC
  console.log('\n2. Testing get_product_reporting_analytics...');
  const { data: prodData, error: prodErr } = await supabase.rpc('get_product_reporting_analytics', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_category_id: null,
    p_product_id: null,
  });

  if (prodErr) {
    console.error('❌ Failed get_product_reporting_analytics:', prodErr);
    process.exit(1);
  }
  console.log(`✅ Product Reporting returned ${prodData.products?.length || 0} product lines.`);

  // 3. Test Customer Reporting Analytics RPC
  console.log('\n3. Testing get_customer_reporting_analytics...');
  const { data: custData, error: custErr } = await supabase.rpc('get_customer_reporting_analytics', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_limit: 10,
    p_offset: 0,
  });

  if (custErr) {
    console.error('❌ Failed get_customer_reporting_analytics:', custErr);
    process.exit(1);
  }
  console.log('✅ Customer Reporting Metrics:');
  console.log(`   • Total Registered Customers: ${custData.metrics.total_customers}`);
  console.log(`   • FIRST500 Consumed: ${custData.first500.consumed_count}/500`);
  console.log(`   • FIRST500 Remaining: ${custData.first500.remaining_eligible}`);

  // 4. Test Supplier Reporting Analytics RPC
  console.log('\n4. Testing get_supplier_reporting_analytics...');
  const { data: suppData, error: suppErr } = await supabase.rpc('get_supplier_reporting_analytics', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
  });

  if (suppErr) {
    console.error('❌ Failed get_supplier_reporting_analytics:', suppErr);
    process.exit(1);
  }
  console.log(`✅ Supplier Reporting returned ${suppData.suppliers?.length || 0} suppliers.`);

  // 5. Test Procurement Reporting Analytics RPC
  console.log('\n5. Testing get_procurement_reporting_analytics...');
  const { data: procData, error: procErr } = await supabase.rpc('get_procurement_reporting_analytics', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_batch_id: null,
  });

  if (procErr) {
    console.error('❌ Failed get_procurement_reporting_analytics:', procErr);
    process.exit(1);
  }
  console.log(`✅ Procurement Reporting returned ${procData.batches?.length || 0} batches & ${procData.items?.length || 0} items.`);

  // 6. Test Sales Financial Analytics RPC
  console.log('\n6. Testing get_sales_financial_analytics...');
  const { data: salesData, error: salesErr } = await supabase.rpc('get_sales_financial_analytics', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
  });

  if (salesErr) {
    console.error('❌ Failed get_sales_financial_analytics:', salesErr);
    process.exit(1);
  }
  console.log('✅ Sales Waterfall Data:');
  console.log(`   • Gross Sales: ₹${salesData.waterfall.gross_sales}`);
  console.log(`   • Total Discounts: -₹${salesData.waterfall.total_discounts}`);
  console.log(`   • Net Revenue: ₹${salesData.waterfall.net_revenue}`);
  console.log(`   • Gross Contribution: ₹${salesData.waterfall.gross_contribution}`);
  console.log(`   • Contribution Margin: ${Number(salesData.waterfall.contribution_margin_pct).toFixed(1)}%`);

  // 7. Test Delivery Reporting Analytics RPC
  console.log('\n7. Testing get_delivery_reporting_analytics...');
  const { data: delData, error: delErr } = await supabase.rpc('get_delivery_reporting_analytics', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_driver_id: null,
  });

  if (delErr) {
    console.error('❌ Failed get_delivery_reporting_analytics:', delErr);
    process.exit(1);
  }
  console.log('✅ Delivery Reporting:');
  console.log(`   • Assigned Deliveries: ${delData.metrics.total_assigned}`);
  console.log(`   • Halol Area count: ${delData.area_breakdown.length}`);
  console.log(`   • Driver Performance count: ${delData.driver_performance.length}`);

  // 8. Test Detailed Orders Report RPC
  console.log('\n8. Testing get_detailed_orders_report...');
  const { data: ordersData, error: ordErr } = await supabase.rpc('get_detailed_orders_report', {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_status: null,
    p_area: null,
    p_search: null,
    p_limit: 10,
    p_offset: 0,
  });

  if (ordErr) {
    console.error('❌ Failed get_detailed_orders_report:', ordErr);
    process.exit(1);
  }
  console.log(`✅ Detailed Orders Report returned ${ordersData.orders?.length || 0} orders (Total matching: ${ordersData.total_count}).`);

  // 9. Test Daily Owner Summary RPC
  console.log('\n9. Testing get_daily_owner_summary...');
  const { data: summaryData, error: sumErr } = await supabase.rpc('get_daily_owner_summary', {
    p_date: today,
  });

  if (sumErr) {
    console.error('❌ Failed get_daily_owner_summary:', sumErr);
    process.exit(1);
  }
  console.log('✅ Daily Executive Summary for today:');
  console.log(`   • Date: ${summaryData.date}`);
  console.log(`   • Orders: ${summaryData.orders_count}`);
  console.log(`   • Top Product: ${summaryData.top_product}`);
  console.log(`   • Godown Volume: ${summaryData.kg_quantity} kg, ${summaryData.bunch_quantity} bunches, ${summaryData.piece_quantity} pcs`);

  console.log('\n================================================================');
  console.log('🎉 ALL OWNER REPORTING & ANALYTICS TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runOwnerReportingTests().catch((err) => {
  console.error('Test execution exception:', err);
  process.exit(1);
});
