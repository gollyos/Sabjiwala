'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AttentionItem, NeedsAttentionSection } from '@/components/ui/NeedsAttentionSection';
import AreaTrendChart, { AreaDataPoint } from '@/components/charts/AreaTrendChart';
import HorizontalBarChart, { BarItem } from '@/components/charts/HorizontalBarChart';
import { TrendingUp, ShoppingBag, DollarSign, Truck, RefreshCw, Tag, Layers, Boxes, ArrowRight, AlertCircle, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { StatCard } from '@/components/ui/StatCard';
import { FlowProgressStrip } from '@/components/ui/FlowProgressStrip';

interface DashboardProduct extends BarItem {
  product_id: string;
}

interface DashboardAttentionItem {
  id?: string;
  type?: string;
  title: string;
  subtitle?: string;
  severity?: AttentionItem['severity'];
}

interface DashboardData {
  kpis?: Record<string, number>;
  daily_summary?: Record<string, number>;
  sales_trend?: AreaDataPoint[];
  top_products?: DashboardProduct[];
  needs_attention?: DashboardAttentionItem[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/reports/dashboard?range=today');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch dashboard data');
      }

      setData(json.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to load business dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning (શુભ પ્રભાત)';
    if (hour < 17) return 'Good Afternoon (શુભ બપોર)';
    return 'Good Evening (શુભ સંધ્યા)';
  };

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const kpis = data?.kpis || {};
  const dailySummary = data?.daily_summary || {};
  const salesTrend: AreaDataPoint[] = data?.sales_trend || [];
  const topProducts: BarItem[] = (data?.top_products || []).slice(0, 5).map((p) => ({
    id: p.product_id,
    name_en: p.name_en,
    name_gu: p.name_gu,
    base_unit: p.base_unit,
    total_quantity: p.total_quantity,
    total_revenue: p.total_revenue,
    gross_contribution: p.gross_contribution,
    orders_count: p.orders_count,
  }));

  // Map needs attention items
  const needsAttentionRaw = data?.needs_attention || [];
  const attentionItems: AttentionItem[] = needsAttentionRaw.map((item, index) => ({
    id: item.id || `${item.type || 'general'}-${index}`,
    type: item.type || 'general',
    title: item.title,
    subtitle: item.subtitle,
    severity: item.severity || 'medium',
    href: 
      item.type === 'packing' ? '/admin/packing' :
      item.type === 'delivery' ? '/admin/delivery' :
      item.type === 'cash' ? '/admin/delivery' :
      item.type === 'stock' ? '/admin/products' : '/admin/orders',
  }));

  // Add settlement discrepancy to attention if exists
  if (Number(kpis.settlement_discrepancy || 0) !== 0) {
    attentionItems.push({
      id: 'cod-diff',
      type: 'cash',
      title: `₹${Math.abs(Number(kpis.settlement_discrepancy)).toFixed(0)} COD Cash Difference`,
      subtitle: 'Settlement discrepancy needs verification',
      severity: 'high',
      href: '/admin/delivery',
    });
  }

  // Calculate comparison deltas
  const salesDelta = kpis.comp_total_sales > 0 
    ? ((kpis.total_sales - kpis.comp_total_sales) / kpis.comp_total_sales) * 100 
    : 0;

  const ordersDelta = kpis.comp_total_orders > 0 
    ? ((kpis.total_orders - kpis.comp_total_orders) / kpis.comp_total_orders) * 100 
    : 0;

  // Contextual Quick Actions depending on time of day
  const currentHour = new Date().getHours();
  const isNightProcurementTime = currentHour >= 19 || currentHour <= 2;
  const isMorningPackingTime = currentHour >= 4 && currentHour <= 10;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Top Header: Simple Greeting & Live Date */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              {getGreeting()}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Today &bull; <span className="font-normal text-slate-500">{todayFormatted}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Refresh live metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/admin/reports"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>All Reports</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. PRIMARY 4 KPI CARDS ONLY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Orders */}
          <StatCard
            title="Orders (ઓર્ડર્સ)"
            value={Number(kpis.total_orders || 0)}
            icon={ShoppingBag}
            iconColor="text-blue-600"
            subValues={[
              { label: 'Delivered', value: kpis.delivered_orders || 0, color: 'text-emerald-700' },
              { label: 'Pending', value: kpis.pending_orders || 0, color: 'text-amber-700' },
            ]}
            trend={ordersDelta !== 0 ? { value: ordersDelta, label: 'volume' } : undefined}
            onClick={() => router.push('/admin/orders')}
          />

          {/* Card 2: Net Sales */}
          <StatCard
            title="Sales (વેચાણ)"
            value={`₹${Number(kpis.total_sales || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            iconColor="text-emerald-600"
            subValues={[
              { label: 'Gross', value: `₹${Number(kpis.gross_sales || 0).toFixed(0)}` },
              { label: 'Disc', value: `-₹${Number((kpis.first500_discount || 0) + (kpis.cod_discount || 0)).toFixed(0)}`, color: 'text-amber-700' },
            ]}
            trend={salesDelta !== 0 ? { value: salesDelta, label: 'vs prev' } : undefined}
            onClick={() => router.push('/admin/reports/sales')}
          />

          {/* Card 3: COD Collected */}
          <StatCard
            title="COD Collected (રોકડ)"
            value={`₹${Number(kpis.collected_cod || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={Truck}
            iconColor="text-cyan-600"
            subValues={[
              { label: 'Cash', value: `₹${Number(kpis.collected_cash || 0).toFixed(0)}` },
              { label: 'UPI', value: `₹${Number(kpis.collected_upi || 0).toFixed(0)}`, color: 'text-cyan-700' },
            ]}
            footerText={`Expected: ₹${Number(kpis.expected_cod || 0).toFixed(0)}`}
            onClick={() => router.push('/admin/delivery')}
          />

          {/* Card 4: Gross Contribution */}
          <StatCard
            title="Contribution (નફો)"
            value={`₹${Number(kpis.gross_contribution || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            iconColor="text-purple-600"
            subValues={[
              { label: 'Cost', value: `₹${Number(kpis.procurement_cost || 0).toFixed(0)}` },
              { 
                label: 'Margin', 
                value: kpis.total_sales > 0 ? `${((kpis.gross_contribution / kpis.total_sales) * 100).toFixed(1)}%` : '0%',
                color: 'text-emerald-700' 
              },
            ]}
            footerText="Net Sales - Mandi Cost - Wastage"
            onClick={() => router.push('/admin/reports/sales')}
          />

        </div>

        {/* 2. NEEDS ATTENTION SECTION */}
        <NeedsAttentionSection items={attentionItems} />

        {/* 3. TODAY'S OPERATIONAL FLOW STRIP */}
        <FlowProgressStrip
          ordersCount={Number(kpis.total_orders || 0)}
          procurementLocked={!!dailySummary.procurement_batch_locked}
          packingPacked={Number(kpis.delivered_orders || 0) + (Number(dailySummary.ready_orders_count || 0))}
          packingTotal={Number(kpis.total_orders || 0)}
          deliveryOut={Number(dailySummary.out_for_delivery_count || 0)}
          deliveryDelivered={Number(kpis.delivered_orders || 0)}
          totalOrders={Number(kpis.total_orders || 0)}
        />

        {/* 4. CONTEXTUAL QUICK ACTIONS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3.5 flex items-center justify-between">
            <span>Quick Actions (ઝડપી કામગીરી)</span>
            <span className="text-[11px] text-slate-400 font-normal">Context-aware shortcuts</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/pricing"
              className="px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs text-slate-700"
            >
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>Update Today&apos;s Prices (ભાવ બદલો)</span>
            </Link>

            <Link
              href="/admin/orders"
              className="px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-blue-50 hover:text-blue-800 border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs text-slate-700"
            >
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span>View Orders (ઓર્ડર્સ જુઓ)</span>
            </Link>

            <Link
              href="/admin/procurement"
              className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                isNightProcurementTime
                  ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 shadow-sm'
                  : 'bg-slate-50 hover:bg-purple-50 hover:text-purple-800 text-slate-700 border-slate-200'
              }`}
            >
              <Boxes className={`w-4 h-4 ${isNightProcurementTime ? 'text-white' : 'text-purple-600'}`} />
              <span>
                {isNightProcurementTime ? "View Tonight's Procurement (8 PM Batch)" : 'Mandi Purchases (ખરીદી સંચાલન)'}
              </span>
            </Link>

            <Link
              href="/admin/packing"
              className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                isMorningPackingTime
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
                  : 'bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border-slate-200'
              }`}
            >
              <Layers className={`w-4 h-4 ${isMorningPackingTime ? 'text-white' : 'text-emerald-600'}`} />
              <span>
                {isMorningPackingTime ? 'Start Morning Packing (પેકિંગ શરૂ કરો)' : 'Godown Packing'}
              </span>
            </Link>

            <Link
              href="/admin/delivery"
              className="px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-cyan-50 hover:text-cyan-800 border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs text-slate-700"
            >
              <Truck className="w-4 h-4 text-cyan-600" />
              <span>Manage Delivery & Driver COD</span>
            </Link>
          </div>
        </div>

        {/* 5. ONLY 1-2 CHARTS (7-Day Sales Trend & Top 5 Products) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chart 1: 7-Day Net Sales Trend (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Sales Trend &bull; Last 7 Days (છેલ્લા ૭ દિવસનું વેચાણ)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daily net realized sales in Halol
                </p>
              </div>
              <Link
                href="/admin/reports/sales"
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>Full Trend</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <AreaTrendChart
              data={salesTrend}
              title=""
              onPointClick={(pt) => {
                router.push(`/admin/orders?start_date=${pt.date}&end_date=${pt.date}`);
              }}
            />
          </div>

          {/* Chart 2: Top Products Today (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Top Vegetables Today (ટોપ શાકભાજી)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Highest volume demanded today
                </p>
              </div>
              <Link
                href="/admin/reports/products"
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>All Products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <HorizontalBarChart
              items={topProducts}
              title=""
              onItemClick={(item) => {
                router.push(`/admin/reports/products?product_id=${item.id}`);
              }}
            />
          </div>

        </div>

      </main>
    </div>
  );
}
