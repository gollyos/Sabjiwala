'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { TrendingUp, Download, RefreshCw } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import FinancialWaterfallChart from '@/components/charts/FinancialWaterfallChart';
import AreaTrendChart, { AreaDataPoint } from '@/components/charts/AreaTrendChart';
import { ReportDatePresetsBar, computePresetDates, DatePresetType } from '@/components/admin/ReportDatePresetsBar';

export default function SalesReportPage() {
  const [activePreset, setActivePreset] = useState<DatePresetType>('30days');
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
      if (!res.ok) {
        throw new Error('Failed to fetch sales analytics');
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch sales analytics');
      }

      setData(json.data);
    } catch (err) {
      setError(getErrorMessage(err));
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
      if (!res.ok) {
        throw new Error('Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taazatokra_sales_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export error: ${getErrorMessage(err)}`);
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

  const handlePresetChange = (preset: DatePresetType) => {
    setActivePreset(preset);
    const { startDate: s, endDate: e } = computePresetDates(preset);
    setStartDate(s);
    setEndDate(e);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              <span>Sales & Financial Analytics (વેચાણ અને આવક રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Gross sales (GMV), FIRST500 &amp; COD discounts, estimated procurement cost, and gross contribution margin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSalesData}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh report data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || dailyBreakdown.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel CSV'}</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Presets Bar */}
        <ReportDatePresetsBar
          startDate={startDate}
          endDate={endDate}
          activePreset={activePreset}
          onPresetChange={handlePresetChange}
          onStartDateChange={(val) => {
            setStartDate(val);
            setActivePreset('custom');
          }}
          onEndDateChange={(val) => {
            setEndDate(val);
            setActivePreset('custom');
          }}
        />

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
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Daily Financial Breakdown ({dailyBreakdown.length} days recorded)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4">Delivery Date</th>
                  <th className="p-4 text-right">Gross Sales (GMV ₹)</th>
                  <th className="p-4 text-right">FIRST500 Disc (₹)</th>
                  <th className="p-4 text-right">COD Disc (₹)</th>
                  <th className="p-4 text-right">Total Disc (₹)</th>
                  <th className="p-4 text-right font-black text-emerald-800">Net Customer Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                      No sales records found for this selected period. Try choosing &quot;Today&quot; or &quot;This Month&quot;.
                    </td>
                  </tr>
                ) : (
                  dailyBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-900 font-sans">{row.label} ({row.delivery_date})</td>
                      <td className="p-4 text-right text-slate-700">₹{Number(row.gross_sales).toFixed(2)}</td>
                      <td className="p-4 text-right text-amber-700">₹{Number(row.first500_discount).toFixed(2)}</td>
                      <td className="p-4 text-right text-amber-700">₹{Number(row.cod_discount).toFixed(2)}</td>
                      <td className="p-4 text-right text-amber-800 font-bold">
                        -₹{(Number(row.first500_discount) + Number(row.cod_discount)).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-black text-emerald-700 text-sm">
                        ₹{Number(row.net_revenue).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
