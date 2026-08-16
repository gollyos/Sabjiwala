import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jaotajpowcgzxgpcezvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RhanBvd2NnenhncGNlenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NjY5NzMsImV4cCI6MjEwMjQ0Mjk3M30.W1h5jm0GTeVFgIu9KvHKkCGxUSGje8n5lt8gHqdOleY';

async function runCartPricingVerification() {
  console.log('=============================================================================');
  console.log('SABJIWALA: CART & SERVER-SIDE PRICING ENGINE VERIFICATION');
  console.log('=============================================================================');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Get active product variants
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

  // Test 1: Anonymous Quote Calculation
  console.log('\n[TEST 1] Testing Anonymous Server Quote...');
  const { data: quote1, error: qErr1 } = await client.rpc('calculate_checkout_quote', {
    p_items: [
      { variant_id: v1.id, quantity: 2 },
      { variant_id: v2.id, quantity: 1 }
    ],
    p_payment_method: 'cod'
  });

  if (qErr1 || !quote1) {
    throw new Error(`Failed to calculate quote 1: ${qErr1?.message}`);
  }

  console.log('✅ Quote 1 Calculated:');
  console.log(`   - Merchandise Subtotal: ₹${quote1.subtotal}`);
  console.log(`   - Min Order Met: ${quote1.minimum_order_met} (Min ₹${quote1.minimum_order_amount})`);
  console.log(`   - COD Discount: ₹${quote1.payment.discount_amount} (${quote1.payment.discount_percentage}%)`);
  console.log(`   - Final Payable: ₹${quote1.final_payable}`);

  // Test 2: Client Price Tampering Protection
  console.log('\n[TEST 2] Verifying Client Price Tampering is Ignored...');
  const { data: tamperedQuote, error: tErr } = await client.rpc('calculate_checkout_quote', {
    p_items: [
      { 
        variant_id: v1.id, 
        quantity: 2, 
        selling_price: 0.01, // Attacker sends ₹0.01!
        subtotal: 0.02,
        discount: 99.99
      }
    ],
    p_payment_method: 'cod'
  });

  if (tErr || !tamperedQuote) {
    throw new Error(`Failed tampered quote: ${tErr?.message}`);
  }

  const expectedSubtotal = Number(v1.selling_price) * 2;
  if (Number(tamperedQuote.subtotal) !== expectedSubtotal) {
    throw new Error(`SECURITY VULNERABILITY: Server accepted client price! Got ₹${tamperedQuote.subtotal}, expected ₹${expectedSubtotal}`);
  }
  console.log(`✅ Tamper-Proofing Passed: Attacker attempted ₹0.01 price, server enforced true rate ₹${v1.selling_price} (Subtotal ₹${tamperedQuote.subtotal}).`);

  // Test 3: Payment Method Comparison (COD 2% vs Online 0%)
  console.log('\n[TEST 3] Comparing Payment Methods (COD 2% vs Online 0%)...');
  const { data: codQuote } = await client.rpc('calculate_checkout_quote', {
    p_items: [{ variant_id: v1.id, quantity: 6 }],
    p_payment_method: 'cod'
  });

  const { data: onlineQuote } = await client.rpc('calculate_checkout_quote', {
    p_items: [{ variant_id: v1.id, quantity: 6 }],
    p_payment_method: 'online'
  });

  console.log(`✅ COD Final Payable: ₹${codQuote.final_payable} (Discount: ₹${codQuote.payment.discount_amount})`);
  console.log(`✅ Online Final Payable: ₹${onlineQuote.final_payable} (Discount: ₹${onlineQuote.payment.discount_amount})`);

  if (Number(codQuote.payment.discount_amount) <= 0 || Number(onlineQuote.payment.discount_amount) !== 0) {
    throw new Error('Payment discount calculation mismatch!');
  }

  // Test 4: Cost Leakage Check in Quote Response
  console.log('\n[TEST 4] Verifying Zero Cost Leakage in Quote...');
  const quoteStr = JSON.stringify(codQuote);
  const sensitiveTerms = ['estimated_cost', 'supplier_price', 'purchase_cost', 'margin'];
  sensitiveTerms.forEach((term) => {
    if (quoteStr.includes(term)) {
      throw new Error(`SECURITY ALERT: Sensitive term "${term}" found in quote response!`);
    }
  });
  console.log('✅ Zero Cost Leakage Verified: No internal cost or margin data in server quote response.');

  console.log('\n=============================================================================');
  console.log('ALL CART & SERVER PRICING VERIFICATION TESTS PASSED 100%!');
  console.log('=============================================================================\n');
}

runCartPricingVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
