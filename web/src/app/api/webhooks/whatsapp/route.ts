import crypto from 'node:crypto';
import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

/**
 * Meta Webhook Verification Handler (GET)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Fail closed: an unset verify token must never fall back to a value that
  // is public (or guessable) in source control.
  if (!expectedToken) {
    console.error('[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not configured — rejecting verification handshake.');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (mode === 'subscribe' && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw request body.
 * Signature = HMAC_SHA256(rawBody, WHATSAPP_APP_SECRET), sent as "sha256=<hex>".
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) {
    return false;
  }

  const providedHex = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  try {
    const expectedBuffer = Buffer.from(expectedHex, 'utf8');
    const providedBuffer = Buffer.from(providedHex, 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Meta Webhook Event & Inbound Message Handler (POST)
 */
export async function POST(req: NextRequest) {
  try {
    // Read the raw body first — the HMAC must be computed over the exact
    // bytes Meta signed, not a re-serialized JSON object.
    const rawBody = await req.text();

    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      // Fail closed and do not leak the missing-config reason to the caller.
      console.error('[WhatsApp Webhook] WHATSAPP_APP_SECRET is not configured — rejecting all inbound webhook POSTs.');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const signatureHeader = req.headers.get('x-hub-signature-256');
    if (!verifyMetaSignature(rawBody, signatureHeader, appSecret)) {
      console.warn('[WhatsApp Webhook] Signature verification failed for inbound webhook POST.');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    let body: any;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }

    // Fetch config & PWA URL from app_settings
    const { data: configRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'whatsapp_config')
      .single();

    const config = configRow?.value || {};
    const pwaBaseUrl = config.pwa_base_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://tajitokri.com';
    const supportMobile = config.support_mobile || process.env.NEXT_PUBLIC_STORE_PHONE || '';

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};

        // 1. Handle Message Status Updates (sent, delivered, read, failed)
        if (value.statuses) {
          for (const statusObj of value.statuses) {
            const wamid = statusObj.id;
            const status = statusObj.status; // 'delivered', 'read', 'failed'

            if (status === 'delivered' || status === 'read') {
              await supabase
                .from('notification_jobs')
                .update({ updated_at: new Date().toISOString() })
                .eq('whatsapp_message_id', wamid);
            } else if (status === 'failed') {
              const errMsg = statusObj.errors?.[0]?.message || 'WhatsApp delivery failure reported by Meta';
              await supabase
                .from('notification_jobs')
                .update({
                  status: 'failed',
                  last_error: errMsg,
                  updated_at: new Date().toISOString(),
                })
                .eq('whatsapp_message_id', wamid);
            }
          }
        }

        // 2. Handle Inbound Customer Messages
        if (value.messages) {
          for (const msg of value.messages) {
            const senderRaw = msg.from; // e.g. "919876543210"
            const senderE164 = senderRaw.startsWith('+') ? senderRaw : `+${senderRaw}`;
            const textBody = msg.text?.body?.trim().toUpperCase() || msg.button?.text?.trim().toUpperCase() || '';

            let replyText = '';

            if (textBody.includes('HELP') || textBody.includes('મદદ') || textBody.includes('SUPPORT')) {
              replyText = `*Taji Tokri Support (તાજી ટોકરી સહાયતા)* 🤝\n\nNeed help with your fresh fruits & vegetables order?${supportMobile ? `\n📞 Call/WhatsApp: ${supportMobile}` : ''}\n🌐 Visit: ${pwaBaseUrl}\n\nDelivery hours: 10:00 AM - 1:00 PM daily.`;
            } else if (textBody.includes('ORDER') || textBody.includes('ઓર્ડર') || textBody.includes('BUY') || textBody.includes('SHOP')) {
              replyText = `*Order Fresh Fruits & Vegetables (તાજા ફળો અને શાકભાજી)* 🍎🥦\n\nPlace your next-day morning delivery order on our web app:\n👉 ${pwaBaseUrl}\n\n• Farm-fresh mandi rates\n• 10% OFF with FIRST500\n• 2% Cash on Delivery discount`;
            } else if (textBody.includes('STATUS') || textBody.includes('MY ORDER') || textBody.includes('TRACK') || textBody.includes('મારો ઓર્ડર')) {
              // Find latest active or recent order for this phone
              const cleanMobile = senderRaw.replace(/[^0-9]/g, '').slice(-10);
              const { data: latestOrder } = await supabase
                .from('orders')
                .select('id, order_number, delivery_date, order_status, final_payable_amount, tracking_token')
                .ilike('customer_mobile_snapshot', `%${cleanMobile}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (latestOrder && latestOrder.tracking_token) {
                const trackUrl = `${pwaBaseUrl}/track/${latestOrder.tracking_token}`;
                replyText = `*Your Latest Taji Tokri Order (તમારો છેલ્લો ઓર્ડર)* 📦\n\n*Order No:* ${latestOrder.order_number}\n*Delivery Date:* ${latestOrder.delivery_date}\n*Status:* ${latestOrder.order_status.toUpperCase()}\n*Payable:* ₹${latestOrder.final_payable_amount}\n\n*Track Details / બિલ જુઓ:* \n${trackUrl}`;
              } else {
                replyText = `*No Active Orders Found*\n\nWe could not find an order linked to ${senderE164}.\nPlace your order fresh at: ${pwaBaseUrl}`;
              }
            } else if (textBody.includes('REPEAT') || textBody.includes('REORDER') || textBody.includes('ફરી ઓર્ડર')) {
              replyText = `*Repeat Previous Order (પાછલો ઓર્ડર ફરી કરો)* 🔄\n\nQuickly reload your favorite fruits & vegetables into cart at current live prices:\n👉 ${pwaBaseUrl}/profile?action=repeat\n\n_Note: Cart will automatically apply today's morning mandi prices._`;
            } else if (textBody.includes('ADDRESS') || textBody.includes('સરનામું')) {
              replyText = `*Manage Delivery Address (સરનામું બદલો)* 📍\n\nUpdate your Halol delivery location and landmarks:\n👉 ${pwaBaseUrl}/profile`;
            } else {
              // Default friendly guidance
              replyText = `*Taji Tokri (તાજી ટોકરી)* 🌿\n\nWelcome! How can we assist you today?\n\nReply with one of these commands:\n• *ORDER* — Shop fresh fruits & vegetables\n• *STATUS* — Track your current order\n• *REPEAT* — Reorder previous items\n• *HELP* — Customer care support\n\n🌐 Visit: ${pwaBaseUrl}`;
            }

            // Dispatch reply
            if (replyText) {
              await sendWhatsAppMessage(senderE164, replyText, config);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(err) || 'Webhook processing exception' },
      { status: 500 }
    );
  }
}
