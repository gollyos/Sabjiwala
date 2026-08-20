import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jaotajpowcgzxgpcezvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RhanBvd2NnenhncGNlenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NjY5NzMsImV4cCI6MjEwMjQ0Mjk3M30.W1h5jm0GTeVFgIu9KvHKkCGxUSGje8n5lt8gHqdOleY';

async function runAtomicOrderTests() {
  console.log('=============================================================================');
  console.log('SABJIWALA: ATOMIC ORDER CREATION & VERIFICATION TEST MATRIX');
  console.log('=============================================================================');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Fetch live product variants & categories
  const { data: variants, error: vErr } = await client
    .from('public_catalog_variants')
    .select('*')
    .order('selling_price', { ascending: false });

  if (vErr || !variants || variants.length === 0) {
    throw new Error(`Failed to load test variants: ${vErr?.message}`);
  }

  const v1 = variants[0];
  const v2 = variants[1] || variants[0];
  console.log(`Using Variant 1: ${v1.variant_name_en} @ ₹${v1.selling_price}`);
  console.log(`Using Variant 2: ${v2.variant_name_en} @ ₹${v2.selling_price}`);

  // Test 1: Anonymous attempt to place order -> Blocked by Auth
  console.log('\n[TEST 1] Testing Unauthenticated Order Creation Attempt...');
  const { error: anonErr } = await client.rpc('create_customer_order', {
    p_customer_address_id: '00000000-0000-0000-0000-000000000000',
    p_payment_method: 'cod',
    p_items: [{ variant_id: v1.id, quantity: 4 }],
    p_idempotency_key: 'ANON-IDEM-001'
  });

  if (!anonErr) {
    throw new Error('SECURITY VIOLATION: Anonymous caller was allowed to place order!');
  }
  console.log(`✅ Anonymous Order Blocked: "${anonErr.message}"`);

  console.log('\n=============================================================================');
  console.log('ANONYMOUS PROTECTION VERIFIED SUCCESSFULLY!');
  console.log('=============================================================================\n');
}

runAtomicOrderTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
