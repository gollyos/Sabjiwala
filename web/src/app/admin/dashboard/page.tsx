'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  Calendar, 
  Download, 
  RefreshCw, 
  Truck, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert,
  Layers,
  FileSpreadsheet,
  ChevronRight,
  CheckCircle2,
  Package,
  Boxes
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import AreaTrendChart, { AreaDataPoint } from '@/components/charts/AreaTrendChart';
import HorizontalBarChart, { BarItem } from '@/components/charts/HorizontalBarChart';
import DonutBreakdownChart, { DonutSegment } from '@/components/charts/DonutBreakdownChart';
import FinancialWaterfallChart from '@/components/charts/FinancialWaterfallChart';

type DatePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'custom';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('range', preset);
      if (preset === 'custom' && customStartDate && customEndDate) {
        params.set('start_date', customStartDate);
        params.set('end_date', customEndDate);
      }

      const res = await fetch(`/api/reports/dashboard?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch dashboard data');
      }

      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reporting dashboard');
    } finally {
      setLoading(false);
    }
  }, [preset, customStartDate, customEndDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleExportCsv = async (type: string = 'orders') => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', type);
      if (data?.period?.start_date) params.set('start_date', data.period.start_date);
      if (data?.period?.end_date) params.set('end_date', data.period.end_date);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sabjiwala_${type}_${data?.period?.start_date}_to_${data?.period?.end_date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const kpis = data?.kpis || {};
  const period = data?.period || {};
  const dailySummary = data?.daily_summary || {};
  const salesTrend: AreaDataPoint[] = data?.sales_trend || [];
  const topProducts: BarItem[] = (data?.top_products || []).map((p: any) => ({
    id: p.product_id,
    name_en: p.name_en,
    name_gu: p.name_gu,
    base_unit: p.base_unit,
    total_quantity: p.total_quantity,
    total_revenue: p.total_revenue,
    gross_contribution: p.gross_contribution,
    orders_count: p.orders_count,
  }));

  const categorySegments: DonutSegment[] = (data?.category_sales || []).map((c: any) => ({
    id: c.category_id,
    label: `${c.name_en} (${c.name_gu})`,
    value: Number(c.revenue || 0),
    formattedValue: `₹${Number(c.revenue || 0).toLocaleString('en-IN')}`,
  }));

  const needsAttention: any[] = data?.needs_attention || [];

  // Calculate comparison deltas
  const salesDelta = kpis.comp_total_sales > 0 
    ? ((kpis.total_sales - kpis.comp_total_sales) / kpis.comp_total_sales) * 100 
    : 0;

  const ordersDelta = kpis.comp_total_orders > 0 
    ? ((kpis.total_orders - kpis.comp_total_orders) / kpis.comp_total_orders) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header & Date Preset Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
              <span>Owner Business Analytics</span>
              <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-mono">
                Live Data
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Authoritative financial & operational insights • Halol Godown
            </p>
          </div>

          {/* Preset Buttons & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Presets */}
            <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPreset('today')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  preset === 'today' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setPreset('yesterday')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  preset === 'yesterday' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setPreset('last_7_days')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  preset === 'last_7_days' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setPreset('last_30_days')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  preset === 'last_30_days' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setPreset('this_month')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  preset === 'this_month' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                This Month
              </button>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* CSV Export Dropdown */}
            <button
              type="button"
              onClick={() => handleExportCsv('orders')}
              disabled={exporting}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Active Range & Date Details */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-slate-400 font-mono">
          <div>
            Showing: <span className="text-white font-bold">{period.start_date || '...'}</span> to{' '}
            <span className="text-white font-bold">{period.end_date || '...'}</span>
          </div>
          {period.compare_start_date && (
            <div>
              Compared against: <span className="text-slate-300">{period.compare_start_date}</span> to{' '}
              <span className="text-slate-300">{period.compare_end_date}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-2xl text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. PRIMARY KPI CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Net Sales */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              <span>Total Net Sales</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              ₹{Number(kpis.total_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span>Gross: ₹{Number(kpis.gross_sales || 0).toFixed(0)}</span>
              <span className="text-amber-400">
                Disc: -₹{Number((kpis.first500_discount || 0) + (kpis.cod_discount || 0)).toFixed(0)}
              </span>
            </div>
            {salesDelta !== 0 && (
              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold">
                {salesDelta > 0 ? (
                  <span className="text-emerald-400 flex items-center">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +{salesDelta.toFixed(1)}% vs prev period
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center">
                    <ArrowDownRight className="w-3.5 h-3.5" /> {salesDelta.toFixed(1)}% vs prev period
                  </span>
                )}
              </div>
            )}
          </div>

          {/* KPI 2: Total Orders */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              <span>Customer Orders</span>
              <ShoppingBag className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {Number(kpis.total_orders || 0)}
            </div>
            <div className="mt-2 text-[11px] font-mono flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span className="text-emerald-400">Delivered: {kpis.delivered_orders || 0}</span>
              <span className="text-amber-400">Pending: {kpis.pending_orders || 0}</span>
              {kpis.failed_orders > 0 && (
                <span className="text-red-400">Failed: {kpis.failed_orders}</span>
              )}
            </div>
            {ordersDelta !== 0 && (
              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold">
                {ordersDelta > 0 ? (
                  <span className="text-emerald-400 flex items-center">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +{ordersDelta.toFixed(1)}% volume
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center">
                    <ArrowDownRight className="w-3.5 h-3.5" /> {ordersDelta.toFixed(1)}% volume
                  </span>
                )}
              </div>
            )}
          </div>

          {/* KPI 3: Gross Contribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              <span>Gross Contribution</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
              ₹{Number(kpis.gross_contribution || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span>Cost: ₹{Number(kpis.procurement_cost || 0).toFixed(0)}</span>
              <span>
                Margin:{' '}
                {kpis.total_sales > 0
                  ? `${((kpis.gross_contribution / kpis.total_sales) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              *Net Sales - Procurement - Wastage
            </div>
          </div>

          {/* KPI 4: COD Collection */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              <span>COD Cash Flow</span>
              <Truck className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              ₹{Number(kpis.collected_cod || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-[11px] font-mono flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span className="text-slate-400">Cash: ₹{Number(kpis.collected_cash || 0).toFixed(0)}</span>
              <span className="text-cyan-400">UPI: ₹{Number(kpis.collected_upi || 0).toFixed(0)}</span>
            </div>
            <div className="mt-2 text-[11px] font-mono flex items-center justify-between">
              <span className="text-slate-500">Expected: ₹{Number(kpis.expected_cod || 0).toFixed(0)}</span>
              {Number(kpis.settlement_discrepancy || 0) !== 0 && (
                <span className="text-red-400 font-bold">
                  Diff: ₹{Number(kpis.settlement_discrepancy).toFixed(0)}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* 2. FINANCIAL WATERFALL */}
        <FinancialWaterfallChart
          grossSales={Number(kpis.gross_sales || 0)}
          first500Discount={Number(kpis.first500_discount || 0)}
          codDiscount={Number(kpis.cod_discount || 0)}
          netRevenue={Number(kpis.total_sales || 0)}
          procurementCost={Number(kpis.procurement_cost || 0)}
          wastageCost={Number(kpis.wastage_cost || 0)}
          grossContribution={Number(kpis.gross_contribution || 0)}
        />

        {/* 3. CHARTS GRID (Trend + Top Products + Category Distribution) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Sales Trend (2 Cols on Large) */}
          <div className="lg:col-span-2">
            <AreaTrendChart
              data={salesTrend}
              title="Daily Net Sales Trend (વેચાણ ટ્રેન્ડ)"
              onPointClick={(pt) => {
                router.push(`/admin/reports/orders?start_date=${pt.date}&end_date=${pt.date}`);
              }}
            />
          </div>

          {/* Category Distribution (1 Col) */}
          <div className="lg:col-span-1">
            <DonutBreakdownChart
              segments={categorySegments}
              title="Category Distribution"
              centerLabel="Net Revenue"
              centerValue={`₹${Number(kpis.total_sales || 0).toLocaleString('en-IN')}`}
            />
          </div>

        </div>

        {/* 4. TOP PRODUCTS & NEEDS ATTENTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top Products Horizontal Bar Chart (2 Cols) */}
          <div className="lg:col-span-2">
            <HorizontalBarChart
              items={topProducts}
              title="Top Products (સૌથી વધુ વેચાતી શાકભાજી)"
              onItemClick={(item) => {
                router.push(`/admin/reports/products?product_id=${item.id}`);
              }}
            />
          </div>

          {/* Needs Attention Panel (1 Col) */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Needs Attention ({needsAttention.length})</span>
              </h3>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Exceptions</span>
            </div>

            {needsAttention.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-bold text-white">All Operations Nominal</div>
                <div className="text-[11px] text-slate-500">
                  No cash settlement discrepancies, failed deliveries, or godown packing issues reported for this period.
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {needsAttention.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`p-3 rounded-2xl border text-xs space-y-1 ${
                      item.severity === 'high'
                        ? 'bg-red-950/40 border-red-800/80 text-red-200'
                        : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{item.title}</span>
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-slate-950">
                        {item.type}
                      </span>
                    </div>
                    {item.subtitle && (
                      <div className="text-[11px] text-slate-300">{item.subtitle}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 5. DAILY EXECUTIVE SUMMARY BLOCK */}
        {dailySummary && dailySummary.success && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Daily Owner Executive Summary • {dailySummary.date}</span>
              </h3>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Net Sales: ₹{Number(dailySummary.total_sales || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-bold">Orders & Deliveries</div>
                <div className="font-mono text-sm font-extrabold text-white">
                  {dailySummary.orders_count} orders ({dailySummary.delivered_count} delivered, {dailySummary.failed_count} failed)
                </div>
                <div className="text-[11px] text-slate-500">
                  Packing issues: {dailySummary.packing_problems}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-bold">Godown Volume & Weight</div>
                <div className="font-mono text-sm font-extrabold text-white">
                  {Number(dailySummary.kg_quantity || 0).toFixed(1)} kg • {dailySummary.bunch_quantity || 0} bunches • {dailySummary.piece_quantity || 0} pcs
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  Top Product: {dailySummary.top_product}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 font-bold">Financials & Settlements</div>
                <div className="font-mono text-sm font-extrabold text-emerald-400">
                  Gross Contribution: ₹{Number(dailySummary.gross_contribution || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400">
                  COD Collected: ₹{Number(dailySummary.cod_collected || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. SUB-REPORT QUICK NAVIGATION CARDS */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Detailed Operational Reports
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/admin/reports/orders"
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-950 text-emerald-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Orders Report
                  </div>
                  <div className="text-[10px] text-slate-500">Filtered line items & delivery addresses</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white" />
            </Link>

            <Link
              href="/admin/reports/sales"
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-950 text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                    Sales & Revenue
                  </div>
                  <div className="text-[10px] text-slate-500">GMV, FIRST500 & margins</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white" />
            </Link>

            <Link
              href="/admin/reports/products"
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-purple-950 text-purple-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                    Product Margins
                  </div>
                  <div className="text-[10px] text-slate-500">Selling price vs purchase costs</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white" />
            </Link>

            <Link
              href="/admin/reports/delivery"
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                    Delivery & COD
                  </div>
                  <div className="text-[10px] text-slate-500">Driver settlements & areas</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white" />
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
