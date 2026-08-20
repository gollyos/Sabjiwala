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

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'sabjiwala_whatsapp_verify_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * Meta Webhook Event & Inbound Message Handler (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await req.json().catch(() => ({}));

    // Fetch config & PWA URL from app_settings
    const { data: configRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'whatsapp_config')
      .single();

    const config = configRow?.value || {};
    const pwaBaseUrl = config.pwa_base_url || 'https://sabjiwala.store';
    const supportMobile = config.support_mobile || '+919876543210';

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
              replyText = `*Sabjiwala Support (શાકભાજીવાળા સહાયતા)* 🤝\n\nNeed help with your fresh vegetable order? Contact our Halol support desk:\n📞 Call/WhatsApp: ${supportMobile}\n🌐 Visit: ${pwaBaseUrl}\n\nDelivery hours: 10:00 AM - 1:00 PM daily.`;
            } else if (textBody.includes('ORDER') || textBody.includes('ઓર્ડર') || textBody.includes('BUY') || textBody.includes('SHOP')) {
              replyText = `*Order Fresh Vegetables (તાજા શાકભાજી ઓર્ડર કરો)* 🥦🍅\n\nPlace your next-day morning delivery order on our web app:\n👉 ${pwaBaseUrl}\n\n• Farm-fresh mandi rates\n• 10% OFF for first 500 customers (FIRST500)\n• 2% Cash on Delivery discount`;
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
                replyText = `*Your Latest Sabjiwala Order (તમારો છેલ્લો ઓર્ડર)* 📦\n\n*Order No:* ${latestOrder.order_number}\n*Delivery Date:* ${latestOrder.delivery_date}\n*Status:* ${latestOrder.order_status.toUpperCase()}\n*Payable:* ₹${latestOrder.final_payable_amount}\n\n*Track Details / બિલ જુઓ:* \n${trackUrl}`;
              } else {
                replyText = `*No Active Orders Found*\n\nWe could not find an order linked to ${senderE164}.\nPlace your order fresh at: ${pwaBaseUrl}`;
              }
            } else if (textBody.includes('REPEAT') || textBody.includes('REORDER') || textBody.includes('ફરી ઓર્ડર')) {
              replyText = `*Repeat Previous Order (પાછલો ઓર્ડર ફરી કરો)* 🔄\n\nQuickly reload your favorite vegetables into cart at current live prices:\n👉 ${pwaBaseUrl}/profile?action=repeat\n\n_Note: Cart will automatically apply today's morning mandi prices._`;
            } else if (textBody.includes('ADDRESS') || textBody.includes('સરનામું')) {
              replyText = `*Manage Delivery Address (સરનામું બદલો)* 📍\n\nUpdate your Halol delivery location and landmarks:\n👉 ${pwaBaseUrl}/profile`;
            } else {
              // Default friendly guidance
              replyText = `*Sabjiwala (શાકભાજીવાળા)* 🥕\n\nWelcome! How can we assist you today?\n\nReply with one of these commands:\n• *ORDER* — Shop fresh vegetables\n• *STATUS* — Track your current order\n• *REPEAT* — Reorder previous items\n• *HELP* — Customer care support\n\n🌐 Visit: ${pwaBaseUrl}`;
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
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Webhook processing exception' },
      { status: 500 }
    );
  }
}
