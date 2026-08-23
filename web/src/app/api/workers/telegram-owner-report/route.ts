import crypto from 'node:crypto';
import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStaffSession, hasAnyRole } from '@/lib/staffAuth';
import { addDaysIST, toISTDate, todayIST } from '@/lib/istDate';
import {
  buildOwnerDailyReportHtml,
  isTelegramConfigured,
  sendTelegramMessage,
  type DailyReportData,
  type DailyReportItem,
} from '@/lib/telegram';

/**
 * Owner's nightly Telegram report: "kal kitna kg ka order aaya hai".
 *
 * Triggered daily at 8:00 PM IST (14:30 UTC) by Vercel cron, or by an
 * n8n cron with the worker secret, or manually by owner/manager.
 * Lives under /api/workers/ so the role middleware does not require a
 * session — the route authenticates cron/n8n callers itself.
 *
 * Orders placed before the 7:50 PM IST cutoff deliver TOMORROW, so the
 * 8:00 PM report for delivery_date = tomorrow is the final procurement
 * list for the next morning's mandi run.
 */

const ACTIVE_ORDER_STATUSES = ['confirmed', 'in_procurement', 'packed', 'out_for_delivery', 'delivered'];
// Fallback only — the live value is read from app_settings.cutoff_time below
// (the same key the admin "Save Cutoff Time" control writes to; see
// migration 20260823000002_fix_order_cutoff_time_consistency.sql) so this
// report's "before cutoff" label never silently drifts from the real cutoff.
const DEFAULT_CUTOFF_MINUTE_IST = 19 * 60 + 50; // 7:50 PM
const IDEMPOTENCY_SETTING_KEY = 'tg_owner_rpt_last';

function secretsMatch(received: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function authorize(request: NextRequest): Promise<{ ok: boolean; error?: string }> {
  // 1. Dedicated worker secret (n8n / external schedulers)
  const authorization = request.headers.get('authorization');
  const bearerSecret = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const workerSecret = request.headers.get('x-worker-secret') || bearerSecret;
  if (workerSecret && secretsMatch(workerSecret, process.env.INTERNAL_WORKER_SECRET)) {
    return { ok: true };
  }

  // 2. Vercel cron (sends GET with Bearer CRON_SECRET + x-vercel-cron header)
  if (request.headers.get('x-vercel-cron')) {
    if (!process.env.CRON_SECRET) {
      return {
        ok: false,
        error: 'Vercel cron called without CRON_SECRET configured. Set CRON_SECRET in the deployment environment.',
      };
    }
    if (secretsMatch(bearerSecret, process.env.CRON_SECRET)) {
      return { ok: true };
    }
  }

  // 3. Signed-in owner/manager (manual test trigger)
  const session = await getStaffSession();
  if (session && hasAnyRole(session, 'owner', 'manager')) {
    return { ok: true };
  }

  return { ok: false };
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized.' },
        { status: 401 }
      );
    }

    if (!isTelegramConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID environment variables.',
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const force = searchParams.get('force') === 'true' || body.force === true;
    const requestedDate = searchParams.get('delivery_date') || (typeof body.delivery_date === 'string' ? body.delivery_date : '');

    // Default target = tomorrow (IST). At 8 PM, after the 7:50 PM cutoff,
    // every order for tomorrow's delivery has been placed.
    const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : addDaysIST(1);
    if (targetDate < todayIST()) {
      return NextResponse.json(
        { success: false, error: 'delivery_date cannot be in the past.' },
        { status: 400 }
      );
    }

    // Idempotency: cron retries must not re-send the same day's report.
    const admin = createAdminClient();
    const { data: settingRow } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', IDEMPOTENCY_SETTING_KEY)
      .maybeSingle();
    const lastSent = (settingRow?.value as { delivery_date?: string; sent_at?: string } | null) ?? null;

    // Daily order cutoff — read from the same app_settings key the admin
    // settings page writes to, so this report stays in sync if the owner
    // changes the cutoff time.
    const { data: cutoffRow } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'cutoff_time')
      .maybeSingle();
    const cutoffTimeStr = (cutoffRow?.value as { time?: string } | null)?.time;
    let cutoffMinuteIST = DEFAULT_CUTOFF_MINUTE_IST;
    if (cutoffTimeStr && /^\d{2}:\d{2}/.test(cutoffTimeStr)) {
      const [cutoffH, cutoffM] = cutoffTimeStr.split(':').map((n) => parseInt(n, 10));
      cutoffMinuteIST = cutoffH * 60 + cutoffM;
    }
    if (!force && lastSent?.delivery_date === targetDate) {
      return NextResponse.json({
        success: true,
        sent: false,
        skipped: 'already_sent_for_this_delivery_date',
        delivery_date: targetDate,
        last_sent_at: lastSent.sent_at || null,
        hint: 'Pass ?force=true to resend.',
      });
    }

    const istNow = toISTDate();
    const minutesOfDay = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
    const generatedAtIST = `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`;

    // Order totals for the target delivery date
    const { data: orderRows, error: orderErr } = await admin
      .from('orders')
      .select('payment_method, final_payable_amount')
      .eq('delivery_date', targetDate)
      .in('order_status', ACTIVE_ORDER_STATUSES);

    if (orderErr) throw orderErr;

    const orders = orderRows || [];
    const totalOrders = orders.length;
    const codOrders = orders.filter((o) => o.payment_method === 'cod').length;
    const onlineOrders = totalOrders - codOrders;
    const orderValue = orders.reduce((sum, o) => sum + (Number(o.final_payable_amount) || 0), 0);

    // Per-product procurement quantities (base units, e.g. kg)
    const { data: itemRows, error: itemErr } = await admin
      .from('order_items')
      .select(`
        product_id,
        equivalent_base_qty,
        product_name_en_snapshot,
        product_name_gu_snapshot,
        unit_code_snapshot,
        orders!inner (order_status, delivery_date)
      `)
      .eq('orders.delivery_date', targetDate)
      .in('orders.order_status', ACTIVE_ORDER_STATUSES);

    if (itemErr) throw itemErr;

    const byProduct = new Map<string, DailyReportItem>();
    for (const row of itemRows || []) {
      const key = row.product_id
        || `${row.product_name_en_snapshot}|${row.unit_code_snapshot}`;
      const existing = byProduct.get(key);
      const qty = Number(row.equivalent_base_qty) || 0;
      if (existing) {
        existing.qty += qty;
      } else {
        byProduct.set(key, {
          nameEn: row.product_name_en_snapshot,
          nameGu: row.product_name_gu_snapshot,
          unit: row.unit_code_snapshot,
          qty,
        });
      }
    }

    const items = Array.from(byProduct.values()).sort((a, b) => b.qty - a.qty);

    const reportData: DailyReportData = {
      deliveryDate: targetDate,
      generatedAtIST,
      beforeCutoff: minutesOfDay < cutoffMinuteIST,
      totalOrders,
      codOrders,
      onlineOrders,
      orderValue,
      items,
    };

    const html = buildOwnerDailyReportHtml(reportData);

    const sendResult = await sendTelegramMessage(html);
    if (!sendResult.success) {
      console.error('[TELEGRAM OWNER REPORT] Send failed:', sendResult.error);
      return NextResponse.json(
        { success: false, error: `Telegram send failed: ${sendResult.error}`, delivery_date: targetDate },
        { status: 502 }
      );
    }

    await admin.from('app_settings').upsert({
      key: IDEMPOTENCY_SETTING_KEY,
      value: { delivery_date: targetDate, sent_at: new Date().toISOString() },
      description: 'Last sent owner daily Telegram procurement report (idempotency marker)',
    });

    return NextResponse.json({
      success: true,
      sent: true,
      delivery_date: targetDate,
      stats: { totalOrders, codOrders, onlineOrders, orderValue, totalItems: items.length },
      report_html: html,
    });
  } catch (err) {
    console.error('[TELEGRAM OWNER REPORT] Failed:', err);
    return NextResponse.json(
      { success: false, error: getErrorMessage(err, 'Report generation failed.') },
      { status: 500 }
    );
  }
}
