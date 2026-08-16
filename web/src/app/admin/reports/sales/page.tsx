'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Download, 
  RefreshCw, 
  DollarSign, 
  Tag, 
  Layers, 
  ArrowUpRight, 
  Boxes,
  Percent
} from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import FinancialWaterfallChart from '@/components/charts/FinancialWaterfallChart';
import AreaTrendChart, { AreaDataPoint } from '@/components/charts/AreaTrendChart';

export default function SalesReportPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSalesData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);

      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch sales analytics');
      }

      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error fetching sales data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', 'sales');
      params.set('start_date', startDate);
      params.set('end_date', endDate);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sabjiwala_sales_${startDate}_to_${endDate}.csv`;
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

  const waterfall = data?.waterfall || {};
  const dailyBreakdown: any[] = data?.daily_breakdown || [];

  const trendData: AreaDataPoint[] = dailyBreakdown.map((d) => ({
    date: d.delivery_date,
    label: d.label,
    gross_sales: Number(d.gross_sales || 0),
    net_sales: Number(d.net_revenue || 0),
    discounts: Number(d.first500_discount || 0) + Number(d.cod_discount || 0),
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
              <span>Sales & Financial Analytics (વેચાણ અને આવક રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              GMV, FIRST500 & COD discount burn, procurement costs, and authoritative gross contribution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSalesData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || dailyBreakdown.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel CSV'}</span>
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <label className="text-slate-400 font-bold uppercase text-[10px]">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-slate-400 font-bold uppercase text-[10px]">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
        </div>

        {/* Financial Step-Down Waterfall */}
        <FinancialWaterfallChart
          grossSales={Number(waterfall.gross_sales || 0)}
          first500Discount={Number(waterfall.first500_discount || 0)}
          codDiscount={Number(waterfall.cod_discount || 0)}
          netRevenue={Number(waterfall.net_revenue || 0)}
          procurementCost={Number(waterfall.procurement_cost || 0)}
          wastageCost={Number(waterfall.wastage_cost || 0)}
          grossContribution={Number(waterfall.gross_contribution || 0)}
          marginPct={Number(waterfall.contribution_margin_pct || 0)}
        />

        {/* Daily Net Sales Trend */}
        <AreaTrendChart
          data={trendData}
          title="Daily Net Revenue Trend"
        />

        {/* Daily Breakdown Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Daily Financial Ledger ({dailyBreakdown.length} days)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Delivery Date</th>
                  <th className="p-3.5 text-right">Gross Sales (GMV ₹)</th>
                  <th className="p-3.5 text-right">FIRST500 Disc (₹)</th>
                  <th className="p-3.5 text-right">COD Disc (₹)</th>
                  <th className="p-3.5 text-right">Total Disc (₹)</th>
                  <th className="p-3.5 text-right font-bold text-emerald-400">Net Customer Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {dailyBreakdown.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-bold text-white font-sans">{row.label} ({row.delivery_date})</td>
                    <td className="p-3.5 text-right text-slate-300">₹{Number(row.gross_sales).toFixed(2)}</td>
                    <td className="p-3.5 text-right text-amber-400">₹{Number(row.first500_discount).toFixed(2)}</td>
                    <td className="p-3.5 text-right text-amber-400">₹{Number(row.cod_discount).toFixed(2)}</td>
                    <td className="p-3.5 text-right text-amber-300 font-bold">
                      -₹{(Number(row.first500_discount) + Number(row.cod_discount)).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-black text-emerald-400 text-sm">
                      ₹{Number(row.net_revenue).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
