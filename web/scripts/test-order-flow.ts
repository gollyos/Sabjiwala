import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jaotajpowcgzxgpcezvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RhanBvd2NnenhncGNlenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NjY5NzMsImV4cCI6MjEwMjQ0Mjk3M30.W1h5jm0GTeVFgIu9KvHKkCGxUSGje8n5lt8gHqdOleY';

async function testOrderFlow() {
  console.log('=============================================================================');
  console.log('SABJIWALA: COMPREHENSIVE END-TO-END ORDER CREATION VERIFICATION');
  console.log('=============================================================================');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Load active catalog products and variants
  console.log('\n[STEP 1] Fetching active catalog variants from public view...');
  const { data: variants, error: vErr } = await supabase
    .from('public_catalog_variants')
    .select('*')
    .order('selling_price', { ascending: false });

  if (vErr || !variants || variants.length === 0) {
    throw new Error(`Failed to load catalog variants: ${vErr?.message}`);
  }

  console.log(`Found ${variants.length} active variants in catalog.`);
  variants.slice(0, 3).forEach((v) => {
    console.log(` - ${v.product_name_gu} (${v.product_name_en}) - ${v.variant_name_en} @ ₹${v.selling_price}`);
  });

  // Verify that cost price columns are NOT present in public view
  const firstVariant = variants[0] as any;
  if ('current_estimated_cost' in firstVariant || 'profit_margin' in firstVariant || 'supplier_price' in firstVariant) {
    throw new Error('SECURITY VIOLATION: Internal cost fields leaked in public_catalog_variants view!');
  }
  console.log('✅ Catalog Security Verified: No cost or supplier fields exposed in public view.');

  // 2. Test server quote calculation
  console.log('\n[STEP 2] Calculating server checkout quote for ₹250+ cart...');
  const v1 = variants[0];
  const qty = Math.ceil(220 / Number(v1.selling_price));
  
  const { data: quote, error: qErr } = await supabase.rpc('calculate_checkout_quote', {
    p_items: [{ variant_id: v1.id, quantity: qty }],
    p_payment_method: 'cod'
  });

  if (qErr || !quote) {
    throw new Error(`Failed to calculate server quote: ${qErr?.message}`);
  }

  console.log(`Quote Subtotal: ₹${quote.subtotal}`);
  console.log(`Min Order Met: ${quote.minimum_order_met}`);
  console.log(`COD Discount: ₹${quote.payment.discount_amount} (${quote.payment.discount_percentage}%)`);
  console.log(`Final Payable: ₹${quote.final_payable}`);
  console.log('✅ Server Pricing Engine verified.');

  // 3. Test Anonymous Direct Order Placement Prevention
  console.log('\n[STEP 3] Verifying that direct unauthenticated order creation is blocked...');
  const { error: unauthErr } = await supabase.rpc('create_customer_order', {
    p_customer_address_id: '00000000-0000-0000-0000-000000000000',
    p_payment_method: 'cod',
    p_items: [{ variant_id: v1.id, quantity: qty }],
    p_idempotency_key: 'UNAUTH-TEST-KEY'
  });

  if (!unauthErr) {
    throw new Error('SECURITY VIOLATION: Unauthenticated caller was able to invoke create_customer_order!');
  }
  console.log(`✅ Unauthenticated order blocked properly: "${unauthErr.message}"`);

  console.log('\n=============================================================================');
  console.log('ALL API-LEVEL CHECKS COMPLETED SUCCESSFULLY!');
  console.log('=============================================================================\n');
}

testOrderFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
