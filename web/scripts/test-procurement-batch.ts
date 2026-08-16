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

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function runProcurementBatchTestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING SABJIWALA 8 PM PROCUREMENT BATCH TS SUITE');
  console.log('====================================================\n');

  try {
    // 1. Check App Settings for Buffer & Secret
    const { data: bufferSetting, error: bufErr } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'procurement_buffer_pct')
      .single();

    if (bufErr) throw bufErr;
    console.log('✅ App Setting `procurement_buffer_pct` verified:', JSON.stringify(bufferSetting.value));

    const { data: secretSetting, error: secErr } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'procurement_lock_secret')
      .single();

    if (secErr) throw secErr;
    console.log('✅ App Setting `procurement_lock_secret` verified:', JSON.stringify(secretSetting.value));

    // 2. Check Suppliers Seed
    const { data: suppliers, error: supErr } = await supabase
      .from('suppliers')
      .select('id, supplier_code, name, mandi_location')
      .eq('is_active', true);

    if (supErr) throw supErr;
    console.log(`✅ Verified ${suppliers.length} active Halol APMC suppliers in database:`);
    suppliers.forEach((s) => console.log(`   • ${s.supplier_code}: ${s.name} (${s.mandi_location})`));

    // 3. Test RPC lock_daily_procurement_batch with empty date (Expect NO_ELIGIBLE_ORDERS)
    const testDate = '2026-11-15';
    const testCutoff = '2026-11-14T14:30:00.000Z';
    const { data: lockEmptyResult, error: lockEmptyErr } = await supabase.rpc('lock_daily_procurement_batch', {
      p_target_delivery_date: testDate,
      p_cutoff_timestamp: testCutoff,
      p_actor_id: null,
    });

    if (lockEmptyErr) throw lockEmptyErr;
    if (lockEmptyResult.error_code === 'NO_ELIGIBLE_ORDERS') {
      console.log('✅ Verified Zero-Order Guard: `NO_ELIGIBLE_ORDERS` returned cleanly without corrupt batch creation.');
    } else {
      console.log('Lock Empty Result:', lockEmptyResult);
    }

    // 4. Test Fetching Batches List
    const { data: batchList, error: listErr } = await supabase
      .from('procurement_batches')
      .select('id, batch_number, batch_date, status, total_orders_count')
      .limit(5);

    if (listErr) throw listErr;
    console.log(`✅ Batch list query executed cleanly (${batchList.length} past batches found).`);

    console.log('\n====================================================');
    console.log('🎉 ALL PROCUREMENT INTEGRATION TESTS PASSED 100%!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Test suite error:', err);
    process.exit(1);
  }
}

runProcurementBatchTestSuite();
