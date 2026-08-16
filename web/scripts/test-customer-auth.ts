import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jaotajpowcgzxgpcezvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RhanBvd2NnenhncGNlenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NjY5NzMsImV4cCI6MjEwMjQ0Mjk3M30.W1h5jm0GTeVFgIu9KvHKkCGxUSGje8n5lt8gHqdOleY';

export function normalizePhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
}

async function runTests() {
  console.log('=============================================================================');
  console.log('SABJIWALA: CUSTOMER AUTH & ADDRESS MODULE AUTOMATED VERIFICATION');
  console.log('=============================================================================');

  // Test 1: Phone Normalization
  console.log('\n[TEST 1] Testing Phone Normalization to E.164...');
  const phone1 = normalizePhone('9876543210');
  const phone2 = normalizePhone('+919876543210');
  const phone3 = normalizePhone('919876543210');
  const phone4 = normalizePhone('98765 43210');
  
  if (phone1 !== '+919876543210' || phone2 !== '+919876543210' || phone3 !== '+919876543210' || phone4 !== '+919876543210') {
    throw new Error(`Phone normalization failed! Got: ${phone1}, ${phone2}, ${phone3}, ${phone4}`);
  }
  console.log('✅ Phone normalization passed: All variants normalized to +919876543210.');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Test 2: Public Browsing Without Auth
  console.log('\n[TEST 2] Verifying Public Catalog Browsing (No Auth Required)...');
  const { data: categories, error: catErr } = await client.from('categories').select('*').eq('is_active', true);
  if (catErr || !categories || categories.length === 0) {
    throw new Error(`Failed to load public categories: ${catErr?.message}`);
  }
  const { data: products, error: prodErr } = await client.from('products').select('*, product_variants(*)').eq('is_active', true);
  if (prodErr || !products || products.length === 0) {
    throw new Error(`Failed to load public products: ${prodErr?.message}`);
  }
  console.log(`✅ Public browsing passed: Loaded ${categories.length} categories and ${products.length} products without login.`);

  // Test 3: Unauthenticated Profile Call
  console.log('\n[TEST 3] Verifying Unauthenticated Profile Query...');
  const { data: anonProfile } = await client.rpc('get_current_customer_profile');
  if (anonProfile && anonProfile.authenticated !== false) {
    throw new Error('Unauthenticated user should return authenticated: false');
  }
  console.log('✅ Anonymous session correctly returned authenticated: false.');

  console.log('\nAll direct API integration tests passed!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
