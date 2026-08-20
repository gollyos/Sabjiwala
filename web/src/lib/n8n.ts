import { getErrorMessage } from '@/lib/errors';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.');
  return createClient(url, key);
}

export interface N8nOrderPayload {
  event: 'ORDER_CREATED' | 'ORDER_DELIVERED' | 'ORDER_CANCELLED' | 'TEST_EVENT';
  timestamp: string;
  source: string;
  order: {
    id: string;
    order_number: string;
    tracking_token: string;
    tracking_url: string;
    admin_order_url: string;
    created_at: string;
    created_date: string;
    month_name: string;
    year: number;
    week_number: number;
    delivery_date: string;
    delivery_slot: string;
    order_status: string;
    payment_status: string;
    payment_method: string;
    customer: {
      id: string;
      name: string;
      mobile: string;
      mobile_e164: string;
      flat_house_no: string;
      society_street: string;
      landmark: string;
      area: string;
      city: string;
      pincode: string;
      full_address: string;
    };
    financials: {
      subtotal_amount: number;
      first_order_discount: number;
      cod_discount: number;
      delivery_charge: number;
      final_payable_amount: number;
      final_payable_formatted: string;
    };
    items_count: number;
    items_summary_text: string;
    items: Array<{
      product_id: string;
      variant_id: string;
      name_en: string;
      name_gu: string;
      variant_en: string;
      variant_gu: string;
      quantity: number;
      unit: string;
      price: number;
      line_total: number;
    }>;
    special_instructions: string | null;
  };
}

interface OrderItemRow {
  product_id: string;
  variant_id: string;
  product_name_en_snapshot: string;
  product_name_gu_snapshot: string;
  variant_name_en_snapshot: string;
  variant_name_gu_snapshot: string;
  quantity: number | string;
  unit_code_snapshot: string;
  selling_price_snapshot: number | string;
  line_total: number | string;
}

function isPublicHttpsWebhook(value: string) {
  try {
    const url = new URL(value);
    const blockedHost = /^(localhost|metadata\.google\.internal|\[::1\]|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname);
    return url.protocol === 'https:' && !blockedHost && !url.hostname.endsWith('.local');
  } catch {
    return false;
  }
}

/**
 * Build rich structured payload and dispatch to n8n webhook
 */
export async function dispatchN8nOrderWebhook(orderId: string, eventType: N8nOrderPayload['event'] = 'ORDER_CREATED') {
  try {
    const supabase = getServiceSupabase();

    // 1. Fetch n8n Webhook URL from app_settings or environment
    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'n8n_config')
      .maybeSingle();

    const n8nConfig = (settingRow?.value as { webhook_url?: string; is_active?: boolean; admin_alert_phone?: string; admin_alert_email?: string }) || {};
    const webhookUrl = n8nConfig.webhook_url || process.env.N8N_ORDER_WEBHOOK_URL;

    // 2. Fetch Complete Order Snapshot
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_id,
        customer_name_snapshot,
        customer_mobile_snapshot,
        delivery_date,
        delivery_slot_start,
        delivery_slot_end,
        delivery_flat_house_snapshot,
        delivery_society_street_snapshot,
        delivery_landmark_snapshot,
        delivery_area_snapshot,
        delivery_city_snapshot,
        delivery_pincode_snapshot,
        subtotal_amount,
        first_order_discount,
        cod_discount,
        delivery_charge,
        final_payable_amount,
        order_status,
        payment_status,
        payment_method,
        special_instructions,
        tracking_token,
        created_at,
        order_items (
          product_id,
          variant_id,
          product_name_en_snapshot,
          product_name_gu_snapshot,
          variant_name_en_snapshot,
          variant_name_gu_snapshot,
          quantity,
          unit_code_snapshot,
          selling_price_snapshot,
          line_total
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.warn('[n8n] Order not found for webhook dispatch:', orderId);
      return { success: false, error: 'Order not found' };
    }

    // Date/Month/Week Calculations
    const createdAtDate = new Date(order.created_at || Date.now());
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = `${monthNames[createdAtDate.getMonth()]} ${createdAtDate.getFullYear()}`;
    
    // Calculate ISO Week Number
    const startOfYear = new Date(createdAtDate.getFullYear(), 0, 1);
    const pastDaysOfYear = (createdAtDate.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

    // Phone normalizer
    const rawMobile = (order.customer_mobile_snapshot || '').replace(/[^0-9]/g, '');
    const mobileE164 = rawMobile.startsWith('91') && rawMobile.length === 12 
      ? `+${rawMobile}` 
      : rawMobile.length === 10 
      ? `+91${rawMobile}` 
      : `+${rawMobile}`;

    const items = (order.order_items as OrderItemRow[] || []).map((it) => ({
      product_id: it.product_id,
      variant_id: it.variant_id,
      name_en: it.product_name_en_snapshot,
      name_gu: it.product_name_gu_snapshot,
      variant_en: it.variant_name_en_snapshot,
      variant_gu: it.variant_name_gu_snapshot,
      quantity: Number(it.quantity),
      unit: it.unit_code_snapshot,
      price: Number(it.selling_price_snapshot),
      line_total: Number(it.line_total),
    }));

    const itemsSummaryText = items
      .map((item) => `${item.quantity}x ${item.name_gu} (${item.variant_gu || item.variant_en})`)
      .join(', ');

    const fullAddress = [
      order.delivery_flat_house_snapshot,
      order.delivery_society_street_snapshot,
      order.delivery_landmark_snapshot ? `Near ${order.delivery_landmark_snapshot}` : '',
      order.delivery_area_snapshot,
      order.delivery_city_snapshot || 'Halol',
      order.delivery_pincode_snapshot || '389350',
    ].filter(Boolean).join(', ');

    const pwaBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://taazatokra.com';
    const trackingUrl = `${pwaBaseUrl}/track/${order.tracking_token || order.id}`;
    const adminOrderUrl = `${pwaBaseUrl}/admin/orders`;

    const payload: N8nOrderPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      source: 'taazatokra_ecommerce_engine',
      order: {
        id: order.id,
        order_number: order.order_number,
        tracking_token: order.tracking_token,
        tracking_url: trackingUrl,
        admin_order_url: adminOrderUrl,
        created_at: order.created_at,
        created_date: createdAtDate.toISOString().split('T')[0],
        month_name: monthName,
        year: createdAtDate.getFullYear(),
        week_number: weekNumber,
        delivery_date: order.delivery_date,
        delivery_slot: '10:00 AM – 01:00 PM',
        order_status: order.order_status,
        payment_status: order.payment_status,
        payment_method: String(order.payment_method).toUpperCase(),
        customer: {
          id: order.customer_id,
          name: order.customer_name_snapshot,
          mobile: order.customer_mobile_snapshot,
          mobile_e164: mobileE164,
          flat_house_no: order.delivery_flat_house_snapshot || '',
          society_street: order.delivery_society_street_snapshot || '',
          landmark: order.delivery_landmark_snapshot || '',
          area: order.delivery_area_snapshot || '',
          city: order.delivery_city_snapshot || 'Halol',
          pincode: order.delivery_pincode_snapshot || '389350',
          full_address: fullAddress,
        },
        financials: {
          subtotal_amount: Number(order.subtotal_amount),
          first_order_discount: Number(order.first_order_discount || 0),
          cod_discount: Number(order.cod_discount || 0),
          delivery_charge: Number(order.delivery_charge || 0),
          final_payable_amount: Number(order.final_payable_amount),
          final_payable_formatted: `₹${Number(order.final_payable_amount).toFixed(2)}`,
        },
        items_count: items.length,
        items_summary_text: itemsSummaryText,
        items,
        special_instructions: order.special_instructions,
      },
    };

    if (!webhookUrl) {
      console.log('[n8n] Webhook URL not configured yet. Payload prepared successfully:', payload.order.order_number);
      return { success: true, dispatched: false, reason: 'n8n_webhook_url_not_set', payload };
    }

    if (!isPublicHttpsWebhook(webhookUrl)) {
      return { success: false, error: 'Configured n8n webhook must use a public HTTPS URL.', payload };
    }

    // 3. Dispatch to n8n Webhook Endpoint
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TaazaTokra-Automation-Engine/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[n8n] Webhook response error (${res.status}):`, errText);
      return { success: false, status: res.status, error: errText, payload };
    }

    console.log(`[n8n] Successfully dispatched order ${payload.order.order_number} to n8n webhook.`);
    return { success: true, dispatched: true, status: res.status, payload };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Unknown n8n dispatch error';
    console.error('[n8n] Webhook dispatch exception:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
