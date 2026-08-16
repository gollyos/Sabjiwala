import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { generateCode128Svg } from '../src/lib/barcode';
import { generateQrCodeSvg } from '../src/lib/qr';

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

async function runWarehousePackingTests() {
  console.log('=============================================================================');
  console.log('STARTING SABJIWALA WAREHOUSE PACKING & THERMAL STICKER INTEGRATION TESTS');
  console.log('=============================================================================\n');

  try {
    // 1. Test Pure Barcode & QR SVG Generation
    console.log('[TEST 1] Testing Pure Barcode & QR SVG Generators...');
    const sampleBarcode = 'SBJ-260817-10125-B01';
    const barcodeSvg = generateCode128Svg(sampleBarcode, { height: 45, barWidth: 2, showText: true });
    if (!barcodeSvg.includes('<svg') || !barcodeSvg.includes(sampleBarcode)) {
      throw new Error(`Invalid Barcode SVG generated: ${barcodeSvg.substring(0, 100)}`);
    }
    console.log('  -> Code128 Barcode SVG generated successfully (Length:', barcodeSvg.length, 'bytes)');

    const sampleQrUrl = 'https://sabjiwala.in/b/BAG-3fa85f6457174526b3fc7c8951a857f7';
    const qrSvg = await generateQrCodeSvg(sampleQrUrl, { width: 100, margin: 1 });
    if (!qrSvg.includes('<svg') && !qrSvg.includes('<rect') && !qrSvg.includes('<path')) {
      throw new Error(`Invalid QR SVG generated: ${qrSvg.substring(0, 100)}`);
    }
    console.log('  -> QR Code SVG generated successfully (Length:', qrSvg.length, 'bytes)');
    console.log('✅ TEST 1 PASSED: Barcode & QR SVG generation validated.\n');

    // 2. Check Printer App Settings
    console.log('[TEST 2] Checking printer settings in app_settings...');
    const { data: printerSettings, error: printSetErr } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'printer_settings')
      .single();

    if (printSetErr) throw printSetErr;
    console.log('  -> Printer settings found:', JSON.stringify(printerSettings.value));
    console.log('✅ TEST 2 PASSED: Printer app_settings validated.\n');

    // 3. Test RPC get_packing_dashboard_stats
    console.log('[TEST 3] Testing get_packing_dashboard_stats RPC...');
    const { data: statsData, error: statsErr } = await supabase.rpc('get_packing_dashboard_stats');
    if (statsErr) throw statsErr;
    console.log('  -> Packing Dashboard Stats:', JSON.stringify(statsData));
    console.log('✅ TEST 3 PASSED: Dashboard statistics RPC validated.\n');

    // 4. Test RPC get_packing_queue
    console.log('[TEST 4] Testing get_packing_queue RPC...');
    const { data: queueData, error: queueErr } = await supabase.rpc('get_packing_queue', {
      p_status_filter: 'all',
    });
    if (queueErr) throw queueErr;
    console.log(`  -> Packing Queue returned successfully (Target Date: ${queueData?.target_date}, Orders: ${queueData?.orders?.length || 0})`);
    console.log('✅ TEST 4 PASSED: Packing queue query verified.\n');

    console.log('=============================================================================');
    console.log('ALL WAREHOUSE PACKING & THERMAL STICKER TESTS COMPLETED SUCCESSFULLY! (100% PASS)');
    console.log('=============================================================================');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('\n❌ TEST FAILED WITH ERROR:', errorMsg);
    process.exit(1);
  }
}

runWarehousePackingTests();
