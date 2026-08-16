/**
 * Sabjiwala WhatsApp Business & Message Rendering Service
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

export function formatBilingualOrderConfirmed(payload: any, pwaBaseUrl: string): string {
  const itemsText = (payload.items_sample || [])
    .map((item: any) => `• ${item.name_en} / ${item.name_gu} (${item.variant || ''}) × ${item.qty} ${item.unit} — ₹${item.total}`)
    .join('\n');

  const moreText = payload.more_items_count > 0 
    ? `\n+ ${payload.more_items_count} more items (અન્ય શાકભાજી)` 
    : '';

  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_id}`;

  return `*Sabjiwala (શાકભાજીવાળા)* ✅
*Order Confirmed / ઓર્ડર કન્ફર્મ થયેલ છે*

*Order No:* ${payload.order_number}
*Delivery Date:* ${payload.delivery_date} (${payload.delivery_slot || '10:00 AM - 1:00 PM'})
*Area:* ${payload.delivery_area}

*Items / શાકભાજી:*
${itemsText}${moreText}

*Subtotal:* ₹${payload.subtotal}
${payload.first500_discount > 0 ? `*FIRST500 Discount:* -₹${payload.first500_discount}\n` : ''}${payload.cod_discount > 0 ? `*COD 2% Discount:* -₹${payload.cod_discount}\n` : ''}*Final COD to Pay:* ₹${payload.final_amount}

*View Order & Track Live / ઓર્ડર જુઓ:*
${trackingLink}

_Need help? Reply HELP or call ${payload.support_mobile || 'Support'}_`;
}

export function formatBilingualOutForDelivery(payload: any, pwaBaseUrl: string): string {
  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_number}`;

  return `*Sabjiwala 🚚 Out for Delivery*
*તમારો ઓર્ડર ડિલિવરી માટે નીકળી ગયો છે*

*Order No:* ${payload.order_number}
*Expected Time:* Today, ${payload.delivery_slot || '10:00 AM - 1:00 PM'}
*COD Amount to Pay:* ₹${payload.final_amount}

Please keep cash or UPI ready at delivery.
મહેરબાની કરીને ડિલિવરી વખતે રોકડ અથવા UPI તૈયાર રાખો.

*Track Driver / ઓર્ડર ટ્રેક કરો:*
${trackingLink}`;
}

export function formatBilingualOrderDelivered(payload: any, pwaBaseUrl: string): string {
  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_number}`;

  return `*Sabjiwala ✅ Order Delivered*
*ઓર્ડર સફળતાપૂર્વક પહોંચાડવામાં આવ્યો છે*

*Order No:* ${payload.order_number}
*Amount Collected:* ₹${payload.amount_collected}
${payload.cash_paid > 0 ? `(Cash: ₹${payload.cash_paid}) ` : ''}${payload.upi_paid > 0 ? `(UPI: ₹${payload.upi_paid})` : ''}

Thank you for choosing Sabjiwala for fresh vegetables!
તાજા શાકભાજી માટે શાકભાજીવાળા પસંદ કરવા બદલ આભાર.

*Receipt & Repeat Order / બિલ અને ફરી ઓર્ડર:*
${trackingLink}

_Any quality issue? Reply HELP within 2 hours._`;
}

export function formatBilingualDeliveryFailed(payload: any, pwaBaseUrl: string): string {
  const trackingLink = `${pwaBaseUrl}/track/${payload.tracking_token || payload.order_number}`;

  return `*Sabjiwala ⚠️ Delivery Update*
*ડિલિવરી અપૂર્ણ રહી છે*

*Order No:* ${payload.order_number}
*Status:* Delivery Attempt Failed
*Reason:* ${payload.reason || 'Customer unavailable / Address unreachable'}

Our operations team will contact you shortly regarding the next delivery attempt.
અમારી ટીમ ટૂંક સમયમાં તમારો સંપર્ક કરશે.

*Order Details:*
${trackingLink}`;
}

export function formatOwnerProcurementReport(payload: any, pwaBaseUrl: string): string {
  const itemsText = (payload.items_sample || [])
    .map((item: any) => `• ${item.name_en} / ${item.name_gu}: *${item.qty} ${item.unit}*`)
    .join('\n');

  const moreText = payload.more_products_count > 0 
    ? `\n+ ${payload.more_products_count} more products` 
    : '';

  return `*SABJIWALA — 8 PM PROCUREMENT REQUIREMENT* 📋
*Halol Mandi Morning Purchase List*

*Delivery Date:* ${payload.delivery_date}
*Total Orders:* ${payload.total_orders}
*Expected COD Collection:* ₹${Number(payload.expected_cod).toLocaleString('en-IN')}
*Batch Number:* ${payload.batch_number}

*VEGETABLE DEMAND (ખરીદી લિસ્ટ):*
${itemsText}${moreText}

*Total Distinct Products:* ${payload.total_products_count}

*Open Owner Admin Dashboard:*
${pwaBaseUrl}/admin/procurement`;
}

export function formatOwnerOperationalAlert(type: string, payload: any, pwaBaseUrl: string): string {
  if (type === 'PACKING_PROBLEM') {
    return `*⚠️ SABJIWALA GODOWN ALERT: PACKING PROBLEM*

*Order:* ${payload.order_number}
*Customer:* ${payload.customer_name} (${payload.customer_mobile})
*Area:* ${payload.area}
*Issue:* ${payload.issue}

*Resolve in Godown:*
${pwaBaseUrl}/admin/packing`;
  }

  if (type === 'COD_DISCREPANCY') {
    return `*🚨 SABJIWALA CASH ALERT: COD DISCREPANCY*

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
    return `*⚠️ SABJIWALA ALERT: DELIVERY FAILED*

*Order:* ${payload.order_number}
*Customer:* ${payload.customer_name} (${payload.customer_mobile})
*Area:* ${payload.area}
*Reason:* ${payload.reason}

*View Delivery Report:*
${pwaBaseUrl}/admin/reports/delivery`;
  }

  return `*SABJIWALA OPERATIONAL ALERT:* ${JSON.stringify(payload)}`;
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

  if (!token || !phoneId || process.env.NODE_ENV === 'test' || token.startsWith('mock_')) {
    // Simulated Dev/Test Transport
    const simulatedMsgId = `wamid.HBgL${Date.now()}_sim_${Math.floor(Math.random() * 100000)}`;
    return {
      success: true,
      messageId: simulatedMsgId
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

    const json = await res.json();
    if (!res.ok || json.error) {
      return {
        success: false,
        error: json.error?.message || `WhatsApp API error (${res.status})`,
      };
    }

    const messageId = json.messages?.[0]?.id || `wamid.${Date.now()}`;
    return { success: true, messageId };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error connecting to Meta WhatsApp API',
    };
  }
}
