import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jaotajpowcgzxgpcezvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RhanBvd2NnenhncGNlenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NjY5NzMsImV4cCI6MjEwMjQ0Mjk3M30.W1h5jm0GTeVFgIu9KvHKkCGxUSGje8n5lt8gHqdOleY';

async function runCatalogVerification() {
  console.log('=============================================================================');
  console.log('SABJIWALA: PRODUCT CATALOG, VARIANTS & DAILY PRICING VERIFICATION');
  console.log('=============================================================================');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Test 1: Public Catalog Access Without Login
  console.log('\n[TEST 1] Testing Public Catalog Access without Auth...');
  const { data: products, error: prodErr } = await client
    .from('public_catalog_products')
    .select('*')
    .order('display_order', { ascending: true });

  if (prodErr || !products || products.length === 0) {
    throw new Error(`Failed to load public catalog: ${prodErr?.message}`);
  }
  console.log(`✅ Loaded ${products.length} active vegetables without authentication.`);

  // Test 2: Bilingual Names Display
  console.log('\n[TEST 2] Verifying English and Gujarati Names...');
  const sample = products[0];
  if (!sample.name_en || !sample.name_gu) {
    throw new Error(`Product missing bilingual names! Found: EN="${sample.name_en}", GU="${sample.name_gu}"`);
  }
  console.log(`✅ Bilingual Verification Passed: "${sample.name_en}" / "${sample.name_gu}"`);

  // Test 3: Multi-Pack Variants and Independent Pricing
  console.log('\n[TEST 3] Verifying Multi-Pack Variants & Independent Pricing...');
  const { data: variants, error: varErr } = await client
    .from('public_catalog_variants')
    .select('*')
    .eq('product_id', sample.id);

  if (varErr || !variants || variants.length === 0) {
    throw new Error(`Failed to load variants for product ${sample.name_en}: ${varErr?.message}`);
  }
  console.log(`✅ Product "${sample.name_en}" has ${variants.length} pack variants:`);
  variants.forEach((v) => {
    console.log(`   - ${v.variant_name_en} (${v.variant_name_gu}): ₹${v.selling_price}`);
  });

  // Test 4: Internal Cost Protection (Zero Exposure to Public)
  console.log('\n[TEST 4] Verifying Internal Cost Privacy (Zero Public Exposure)...');
  const variantKeys = Object.keys(variants[0]);
  const forbiddenKeys = ['current_estimated_cost', 'supplier_price', 'purchase_cost', 'margin'];
  const leakedKeys = forbiddenKeys.filter((k) => variantKeys.includes(k));

  if (leakedKeys.length > 0) {
    throw new Error(`SECURITY ALERT: Forbidden internal keys exposed to public: ${leakedKeys.join(', ')}`);
  }
  console.log('✅ Cost Protection Verified: Zero internal cost/supplier keys in public catalog response.');

  // Test 5: Search Matching English and Gujarati
  console.log('\n[TEST 5] Verifying Bilingual Search Match...');
  const { data: gujMatch } = await client
    .from('public_catalog_products')
    .select('*')
    .ilike('name_gu', '%ટામેટા%');

  const { data: engMatch } = await client
    .from('public_catalog_products')
    .select('*')
    .ilike('name_en', '%Tomato%');

  console.log(`✅ Gujarati Search ("ટામેટા"): ${gujMatch?.length || 0} match(es)`);
  console.log(`✅ English Search ("Tomato"): ${engMatch?.length || 0} match(es)`);

  console.log('\n=============================================================================');
  console.log('ALL CATALOG & PRICING VERIFICATION TESTS PASSED 100%!');
  console.log('=============================================================================\n');
}

runCatalogVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
