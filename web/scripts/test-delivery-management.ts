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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function runDeliveryManagementTests() {
  console.log('=============================================================================');
  console.log('STARTING SABJIWALA DELIVERY MANAGEMENT & COD COLLECTION INTEGRATION TESTS');
  console.log('=============================================================================\n');

  try {
    // 1. Test Admin Summary RPC
    console.log('[TEST 1] Testing get_admin_delivery_dashboard_stats RPC...');
    const { data: adminStats, error: adminErr } = await supabase.rpc('get_admin_delivery_dashboard_stats');
    if (adminErr) throw adminErr;
    console.log('  -> Admin Delivery Stats:', JSON.stringify(adminStats.metrics));
    console.log(`  -> Active Batches: ${adminStats.batches?.length || 0}, Settlements: ${adminStats.settlements?.length || 0}`);
    console.log('✅ TEST 1 PASSED: Admin dashboard RPC validated.\n');

    // 2. Fetch or verify active delivery driver
    console.log('[TEST 2] Verifying delivery drivers list...');
    const { data: drivers, error: driverErr } = await supabase
      .from('user_profiles')
      .select('id, full_name, mobile')
      .eq('is_active', true)
      .limit(1);

    if (driverErr) throw driverErr;
    if (!drivers || drivers.length === 0) {
      console.log('  -> Note: No active drivers currently in database. Testing summary with fallback UUID.');
    } else {
      console.log(`  -> Found active driver: ${drivers[0].full_name} (${drivers[0].mobile})`);
    }

    const testDriverId = drivers?.[0]?.id || '00000000-0000-0000-0000-000000000001';

    // 3. Test Driver Summary RPC
    console.log('[TEST 3] Testing get_driver_deliveries_summary RPC...');
    const { data: driverSummary, error: driverSumErr } = await supabase.rpc('get_driver_deliveries_summary', {
      p_driver_user_id: testDriverId,
    });
    if (driverSumErr) throw driverSumErr;
    console.log('  -> Driver Deliveries Summary for date', driverSummary.delivery_date, ':', JSON.stringify(driverSummary.metrics));
    console.log('✅ TEST 3 PASSED: Driver summary RPC validated.\n');

    // 4. Validate Table Structure for driver_cash_settlements
    console.log('[TEST 4] Verifying driver_cash_settlements table access...');
    const { data: settlements, error: setErr } = await supabase
      .from('driver_cash_settlements')
      .select('id, status, expected_cash_amount, handed_over_cash_amount')
      .limit(5);

    if (setErr) throw setErr;
    console.log(`  -> Accessible settlements count: ${settlements?.length || 0}`);
    console.log('✅ TEST 4 PASSED: driver_cash_settlements verified.\n');

    console.log('=============================================================================');
    console.log('ALL DELIVERY MANAGEMENT INTEGRATION TESTS COMPLETED SUCCESSFULLY! (100% PASS)');
    console.log('=============================================================================');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('\n❌ TEST FAILED WITH ERROR:', errorMsg);
    process.exit(1);
  }
}

runDeliveryManagementTests();
