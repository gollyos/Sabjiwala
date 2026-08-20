import { getErrorMessage } from '@/lib/errors';


/**
 * TaazaTokra WhatsApp Business & Message Rendering Service
 * Handles bilingual (English / Gujarati) formatting and Meta Cloud API integration.
 */

export interface WhatsAppConfig {
  enabled: boolean;
  provider: string;
  apiVersion?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string;
  ownerMobile: string;
  managerMobile?: string;
  supportMobile: string;
  pwaBaseUrl: string;
}

interface WhatsAppItemSample {
  name_en: string;
  name_gu: string;
  variant?: string;
  qty: number;
  unit: string;
  total?: number;
}

interface WhatsAppPayload {
  order_id?: string;
  order_number?: string;
  tracking_token?: string;
  delivery_date?: string;
  delivery_slot?: string;
  delivery_area?: string;
  items_sample?: WhatsAppItemSample[];
  more_items_count?: number;
  subtotal?: number;
  first500_discount?: number;
  cod_discount?: number;
  final_amount?: number;
  support_mobile?: string;
  amount_collected?: number;
  cash_paid?: number;
  upi_paid?: number;
  reason?: string;
  more_products_count?: number;
  total_orders?: number;
  expected_cod?: number;
  batch_number?: string;
  total_products_count?: number;
  customer_name?: string;
  customer_mobile?: string;
  area?: string;
  issue?: string;
  driver_name?: string;
  expected_cash?: number;
  collected_cash?: number;
  handed_over_cash?: number;
  difference?: number;
  notes?: string;
  [key: string]: unknown;
}

export function formatBilingualOrderConfirmed(payload: WhatsAppPayload, pwaBaseUrl: string): string {
  const itemsText = (payload.items_sample || [])
    .map((item) => `• ${item.name_en} / ${item.name_gu} (${item.variant || ''}) × ${item.qty} ${item.unit} — ₹${item.total}`)
    .join('\n');

  const moreText = Number(payload.more_items_count || 0) > 0 
    ? `\n+ ${payload.more_items_count} more items (અન્ય વસ્તુઓ)` 
    : '';

  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_id}`;

  return `*TaazaTokra (તાજાટોકરા)* ✅
*Order Confirmed / ઓર્ડર કન્ફર્મ થયેલ છે*

*Order No:* ${payload.order_number}
*Delivery Date:* ${payload.delivery_date} (${payload.delivery_slot || '10:00 AM - 1:00 PM'})
*Area:* ${payload.delivery_area}

*Items / ફળ અને શાકભાજી:*
${itemsText}${moreText}

*Subtotal:* ₹${payload.subtotal}
${Number(payload.first500_discount || 0) > 0 ? `*FIRST500 Discount:* -₹${payload.first500_discount}\n` : ''}${Number(payload.cod_discount || 0) > 0 ? `*COD 2% Discount:* -₹${payload.cod_discount}\n` : ''}*Final COD to Pay:* ₹${payload.final_amount}

*View Order & Track Live / ઓર્ડર જુઓ:*
${trackingLink}

_Need help? Reply HELP or call ${payload.support_mobile || 'Support'}_`;
}

export function formatBilingualOutForDelivery(payload: WhatsAppPayload, pwaBaseUrl: string): string {
  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_number}`;

  return `*TaazaTokra 🚚 Out for Delivery*
*તમારો ઓર્ડર ડિલિવરી માટે નીકળી ગયો છે*

*Order No:* ${payload.order_number}
*Expected Time:* Today, ${payload.delivery_slot || '10:00 AM - 1:00 PM'}
*COD Amount to Pay:* ₹${payload.final_amount}

Please keep cash or UPI ready at delivery.
મહેરબાની કરીને ડિલિવરી વખતે રોકડ અથવા UPI તૈયાર રાખો.

*Track Driver / ઓર્ડર ટ્રેક કરો:*
${trackingLink}`;
}

export function formatBilingualOrderDelivered(payload: WhatsAppPayload, pwaBaseUrl: string): string {
  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_number}`;

  return `*TaazaTokra ✅ Order Delivered*
*ઓર્ડર સફળતાપૂર્વક પહોંચાડવામાં આવ્યો છે*

*Order No:* ${payload.order_number}
*Amount Collected:* ₹${payload.amount_collected}
${Number(payload.cash_paid || 0) > 0 ? `(Cash: ₹${payload.cash_paid}) ` : ''}${Number(payload.upi_paid || 0) > 0 ? `(UPI: ₹${payload.upi_paid})` : ''}

Thank you for choosing TaazaTokra for fresh fruits & vegetables!
તાજા ફળો અને શાકભાજી માટે તાજાટોકરા પસંદ કરવા બદલ આભાર.

*Receipt & Repeat Order / બિલ અને ફરી ઓર્ડર:*
${trackingLink}

_Any quality issue? Reply HELP within 2 hours._`;
}

export function formatBilingualDeliveryFailed(payload: WhatsAppPayload, pwaBaseUrl: string): string {
  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_number}`;

  return `*TaazaTokra ⚠️ Delivery Update*
*ડિલિવરી અપૂર્ણ રહી છે*

*Order No:* ${payload.order_number}
*Status:* Delivery Attempt Failed
*Reason:* ${payload.reason || 'Customer unavailable / Address unreachable'}

Our operations team will contact you shortly regarding the next delivery attempt.
અમારી ટીમ ટૂંક સમયમાં તમારો સંપર્ક કરશે.

*Order Details:*
${trackingLink}`;
}

export function formatOwnerProcurementReport(payload: WhatsAppPayload, pwaBaseUrl: string): string {
  const itemsText = (payload.items_sample || [])
    .map((item) => `• ${item.name_en} / ${item.name_gu}: *${item.qty} ${item.unit}*`)
    .join('\n');

  const moreText = Number(payload.more_products_count || 0) > 0 
    ? `\n+ ${payload.more_products_count} more products` 
    : '';

  return `*TAAZATOKRA — 8 PM PROCUREMENT REQUIREMENT* 📋
*Halol Mandi Morning Purchase List*

*Delivery Date:* ${payload.delivery_date}
*Total Orders:* ${payload.total_orders}
*Expected COD Collection:* ₹${Number(payload.expected_cod).toLocaleString('en-IN')}
*Batch Number:* ${payload.batch_number}

*FRUIT & VEGETABLE DEMAND (ખરીદી લિસ્ટ):*
${itemsText}${moreText}

*Total Distinct Products:* ${payload.total_products_count}

*Open Owner Admin Dashboard:*
${pwaBaseUrl}/admin/procurement`;
}

export function formatOwnerOperationalAlert(type: string, payload: WhatsAppPayload, pwaBaseUrl: string): string {
  if (type === 'PACKING_PROBLEM') {
    return `*⚠️ TAAZATOKRA GODOWN ALERT: PACKING PROBLEM*

*Order:* ${payload.order_number}
*Customer:* ${payload.customer_name} (${payload.customer_mobile})
*Area:* ${payload.area}
*Issue:* ${payload.issue}

*Resolve in Godown:*
${pwaBaseUrl}/admin/packing`;
  }

  if (type === 'COD_DISCREPANCY') {
    return `*🚨 TAAZATOKRA CASH ALERT: COD DISCREPANCY*

*Driver:* ${payload.driver_name}
*Date:* ${payload.delivery_date}
*Expected Cash:* ₹${payload.expected_cash}
*Collected Cash:* ₹${payload.collected_cash}
*Handed Over:* ₹${payload.handed_over_cash}
*Discrepancy:* *₹${payload.difference}*
*Notes:* ${payload.notes || 'None'}

*Inspect Settlements:*
${pwaBaseUrl}/admin/reports/delivery`;
  }

  if (type === 'DELIVERY_FAILED') {
    return `*⚠️ TAAZATOKRA ALERT: DELIVERY FAILED*

*Order:* ${payload.order_number}
*Customer:* ${payload.customer_name} (${payload.customer_mobile})
*Area:* ${payload.area}
*Reason:* ${payload.reason}

*View Delivery Report:*
${pwaBaseUrl}/admin/reports/delivery`;
  }

  return `*TAAZATOKRA OPERATIONAL ALERT:* ${JSON.stringify(payload)}`;
}

/**
 * Dispatch message via Meta WhatsApp Cloud API or simulated development transport
 */
export async function sendWhatsAppMessage(
  recipient: string,
  messageText: string,
  config?: Partial<WhatsAppConfig>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || config?.phoneNumberId;

  // Clean E.164 recipient for Meta API (digits only, e.g. 919876543210)
  const metaRecipient = recipient.replace(/[^0-9]/g, '');

  if (process.env.NODE_ENV === 'test' || (process.env.NODE_ENV !== 'production' && token?.startsWith('mock_'))) {
    // Simulated Dev/Test Transport
    const simulatedMsgId = `wamid.HBgL${Date.now()}_sim_${Math.floor(Math.random() * 100000)}`;
    return {
      success: true,
      messageId: simulatedMsgId
    };
  }

  if (!token || !phoneId) {
    return {
      success: false,
      error: 'WhatsApp delivery is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
    };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: metaRecipient,
        type: 'text',
        text: { preview_url: true, body: messageText },
      }),
    });

    const json = await res.json() as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };
    if (!res.ok || json.error) {
      return {
        success: false,
        error: json.error?.message || `WhatsApp API error (${res.status})`,
      };
    }

    const messageId = json.messages?.[0]?.id || `wamid.${Date.now()}`;
    return { success: true, messageId };
  } catch (err) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Network error connecting to Meta WhatsApp API',
    };
  }
}
