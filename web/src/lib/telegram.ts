/**
 * Telegram Bot API client for owner-facing operational reports.
 *
 * Server-side only — the bot token must never reach the browser. Configure:
 *   TELEGRAM_BOT_TOKEN   — token from @BotFather
 *   TELEGRAM_OWNER_CHAT_ID — owner's chat id (numeric id or @channelname)
 */

export interface DailyReportItem {
  nameEn: string;
  nameGu: string;
  unit: string;
  qty: number;
}

export interface DailyReportData {
  deliveryDate: string;        // YYYY-MM-DD
  generatedAtIST: string;      // human-readable IST timestamp
  beforeCutoff: boolean;       // generated before the 7:50 PM IST cutoff
  totalOrders: number;
  codOrders: number;
  onlineOrders: number;
  orderValue: number;
  items: DailyReportItem[];
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_OWNER_CHAT_ID);
}

export async function sendTelegramMessage(
  html: string,
  chatIdOverride?: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride || process.env.TELEGRAM_OWNER_CHAT_ID;

  if (!token || !chatId) {
    return { success: false, error: 'Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID missing).' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !body?.ok) {
      return { success: false, error: body?.description || `Telegram API returned HTTP ${res.status}.` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Telegram request failed.' };
  }
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const formatQty = (qty: number): string => String(Number(qty.toFixed(2)));

const formatMoney = (value: number): string =>
  `₹${Number(value.toFixed(0)).toLocaleString('en-IN')}`;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDisplayDate = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/**
 * Builds the owner's nightly Telegram report: how much to buy in tomorrow
 * morning's mandi run. Orders placed before the 7:50 PM cutoff deliver the
 * next day, so the 8:00 PM report for delivery_date = tomorrow is final.
 */
export function buildOwnerDailyReportHtml(data: DailyReportData): string {
  const lines: string[] = [];

  lines.push('🥬 <b>Sabjiwala — Kal ki Delivery Report</b>');
  lines.push(`📅 Delivery: <b>${escapeHtml(formatDisplayDate(data.deliveryDate))}</b> • Report: ${escapeHtml(data.generatedAtIST)} IST`);
  lines.push('');

  lines.push(`📦 Orders: <b>${data.totalOrders}</b> (COD ${data.codOrders} • Online ${data.onlineOrders})`);
  lines.push(`💰 Order Value: <b>${formatMoney(data.orderValue)}</b>`);
  lines.push('');

  if (data.items.length === 0) {
    lines.push('😕 Kal ki delivery ke liye abhi koi active order nahi hai.');
  } else {
    lines.push('🧺 <b>Kal mandi se khareedna hai:</b>');
    const shown = data.items.slice(0, 15);
    shown.forEach((item, idx) => {
      const gu = item.nameGu ? ` (${escapeHtml(item.nameGu)})` : '';
      lines.push(`${idx + 1}. ${escapeHtml(item.nameEn)}${gu} — <b>${formatQty(item.qty)} ${escapeHtml(item.unit)}</b>`);
    });
    if (data.items.length > shown.length) {
      lines.push(`<i>…+ ${data.items.length - shown.length} more items</i>`);
    }
    lines.push('');
    lines.push(`📊 Total items: ${data.items.length}`);
  }

  if (data.beforeCutoff) {
    lines.push('');
    lines.push('⚠️ <i>Report 7:50 PM cutoff se pehle generate hua — numbers abhi badal sakte hain.</i>');
  } else {
    lines.push('');
    lines.push('⏰ 7:50 PM ke baad ke orders day-after-tomorrow delivery me jayenge.');
  }

  return lines.join('\n');
}
