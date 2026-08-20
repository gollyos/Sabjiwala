import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { formatBilingualOrderConfirmed, formatBilingualOutForDelivery, formatBilingualOrderDelivered, formatBilingualDeliveryFailed, formatOwnerProcurementReport, sendWhatsAppMessage } from '../src/lib/whatsapp';

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

async function runWhatsAppNotificationTests() {
  console.log('================================================================');
  console.log('🚀 SABJIWALA: WHATSAPP BUSINESS & n8n AUTOMATION INTEGRATION TEST');
  console.log('================================================================\n');

  const pwaBaseUrl = 'https://sabjiwala.store';

  // 1. Test Bilingual Message Formatting
  console.log('1. Testing Bilingual Message Rendering...');
  const sampleOrderPayload = {
    order_id: '11111111-2222-3333-4444-555555555555',
    order_number: 'SBJ-20260817-0042',
    delivery_date: '17 Aug 2026',
    delivery_slot: '10:00 AM - 1:00 PM',
    delivery_area: 'Halol Town',
    subtotal: 350,
    first500_discount: 35,
    cod_discount: 7,
    final_amount: 308,
    tracking_token: 'trk_sample_token_halol_001',
    support_mobile: '+919876543210',
    items_sample: [
      { name_en: 'Tomato', name_gu: 'ટામેટાં', variant: '1 kg', qty: 2, unit: 'kg', price: 40, total: 80 },
      { name_en: 'Potato', name_gu: 'બટાટા', variant: '1 kg', qty: 3, unit: 'kg', price: 30, total: 90 },
      { name_en: 'Coriander', name_gu: 'કોથમીર', variant: 'Bunch', qty: 2, unit: 'bunch', price: 15, total: 30 },
    ],
    more_items_count: 0
  };

  const orderMsg = formatBilingualOrderConfirmed(sampleOrderPayload, pwaBaseUrl);
  if (!orderMsg.includes('Sabjiwala') || !orderMsg.includes('SBJ-20260817-0042') || !orderMsg.includes('ટામેટાં')) {
    throw new Error('Order confirmation formatting missing key Gujarati/English fields');
  }
  console.log('✅ Bilingual Order Confirmation rendered successfully:');
  console.log('----------------------------------------------------');
  console.log(orderMsg);
  console.log('----------------------------------------------------\n');

  // 2. Test Out for Delivery & Delivered Formatting
  console.log('2. Testing Delivery Status & Bill Summary Rendering...');
  const outForDeliveryMsg = formatBilingualOutForDelivery(sampleOrderPayload, pwaBaseUrl);
  const deliveredMsg = formatBilingualOrderDelivered({
    ...sampleOrderPayload,
    amount_collected: 308,
    cash_paid: 308,
    upi_paid: 0
  }, pwaBaseUrl);
  const failedMsg = formatBilingualDeliveryFailed({
    ...sampleOrderPayload,
    reason: 'Customer phone unreachable'
  }, pwaBaseUrl);

  if (!outForDeliveryMsg.includes('Out for Delivery') || !deliveredMsg.includes('Order Delivered') || !failedMsg.includes('Delivery Update')) {
    throw new Error('Delivery status formatting failed');
  }
  console.log('✅ Out for Delivery, Delivered Bill, and Failure message templates verified.');

  // 3. Test Owner 8 PM Procurement Report Formatting
  console.log('\n3. Testing Owner 8 PM Procurement Report Template...');
  const sampleProcPayload = {
    batch_id: '22222222-3333-4444-5555-666666666666',
    batch_number: 'PB-20260817-HALOL',
    delivery_date: '17 Aug 2026',
    total_orders: 74,
    expected_cod: 22472,
    total_products_count: 26,
    items_sample: [
      { name_en: 'Tomato', name_gu: 'ટામેટાં', qty: 32, unit: 'kg' },
      { name_en: 'Potato', name_gu: 'બટાટા', qty: 48, unit: 'kg' },
      { name_en: 'Onion', name_gu: 'ડુંગળી', qty: 41, unit: 'kg' },
      { name_en: 'Coriander', name_gu: 'કોથમીર', qty: 38, unit: 'bunch' },
    ],
    more_products_count: 22
  };

  const procMsg = formatOwnerProcurementReport(sampleProcPayload, pwaBaseUrl);
  if (!procMsg.includes('8 PM PROCUREMENT REQUIREMENT') || !procMsg.includes('PB-20260817-HALOL') || !procMsg.includes('22,472')) {
    throw new Error('8 PM Procurement Report template error');
  }
  console.log('✅ 8 PM Owner Procurement Summary rendered successfully:');
  console.log('----------------------------------------------------');
  console.log(procMsg);
  console.log('----------------------------------------------------\n');

  // 4. Test Simulated Meta Transport Dispatch
  console.log('4. Testing WhatsApp Message Transport Dispatch...');
  const sendRes = await sendWhatsAppMessage('+919876543210', orderMsg);
  if (!sendRes.success || !sendRes.messageId) {
    throw new Error(`Dispatch failed: ${sendRes.error}`);
  }
  console.log(`✅ Message dispatched successfully (Message ID: ${sendRes.messageId})`);

  // 5. Test Notification Queue DB RPC Enqueue
  console.log('\n5. Testing Notification Queue DB Enqueue RPC...');
  const testIdempotencyKey = `TS_TEST_${Date.now()}`;
  const { data: jobId, error: rpcErr } = await supabase.rpc('enqueue_notification_job', {
    p_idempotency_key: testIdempotencyKey,
    p_notification_type: 'ORDER_CONFIRMED',
    p_recipient: '+919876543210',
    p_template_key: 'customer_order_confirmed',
    p_payload: sampleOrderPayload,
    p_customer_id: null,
    p_order_id: null,
    p_batch_id: null,
    p_channel: 'whatsapp'
  });

  if (rpcErr || !jobId) {
    throw new Error(`Failed to enqueue via RPC: ${rpcErr?.message}`);
  }
  console.log(`✅ Enqueued test notification job ID via RPC: ${jobId}`);

  // Test deduplication with same idempotency key
  const { data: duplicateJobId } = await supabase.rpc('enqueue_notification_job', {
    p_idempotency_key: testIdempotencyKey,
    p_notification_type: 'ORDER_CONFIRMED',
    p_recipient: '+919876543210',
    p_template_key: 'customer_order_confirmed',
    p_payload: sampleOrderPayload,
    p_customer_id: null,
    p_order_id: null,
    p_batch_id: null,
    p_channel: 'whatsapp'
  });

  if (duplicateJobId !== null) {
    throw new Error('Deduplication failed: duplicate job ID returned instead of null');
  }
  console.log(`✅ Verified deduplication: duplicate key returned null as expected.`);

  console.log('\n================================================================');
  console.log('🎉 ALL WHATSAPP & NOTIFICATION AUTOMATION TESTS PASSED!');
  console.log('================================================================\n');
}

runWhatsAppNotificationTests().catch((err) => {
  console.error('Test execution exception:', err);
  process.exit(1);
});
