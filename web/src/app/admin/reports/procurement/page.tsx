'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { Boxes, Download, RefreshCw } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { ReportDatePresetsBar, computePresetDates, DatePresetType } from '@/components/admin/ReportDatePresetsBar';
import { addDaysIST, todayIST } from '@/lib/istDate';

export default function ProcurementReportingPage() {
  const [activePreset, setActivePreset] = useState<DatePresetType>('30days');
  const [startDate, setStartDate] = useState(() => {
    return addDaysIST(-29);
  });
  const [endDate, setEndDate] = useState(() => todayIST());
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProcurementData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (selectedBatchId) params.set('batch_id', selectedBatchId);

      const res = await fetch(`/api/reports/procurement?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch procurement analytics');
      }

      setData(json.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error loading procurement reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedBatchId]);

  useEffect(() => {
    fetchProcurementData();
  }, [fetchProcurementData]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', 'procurement');
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (selectedBatchId) params.set('batch_id', selectedBatchId);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taazatokra_procurement_${startDate}_to_${endDate}.csv`;
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

  const summary = data?.summary || {};
  const batches: any[] = data?.batches || [];
  const items: any[] = data?.items || [];

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
              <Boxes className="w-6 h-6 text-emerald-600" />
              <span>Procurement &amp; Wastage Analysis (ખરીદી અને બગાડ રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              8 PM batch frozen demand vs actual mandi purchases, receiving weights, usable quantities, and wastage costs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProcurementData}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh report data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || items.length === 0}
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


        {/* Secondary Filters Bar: Batch Selector */}
        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs text-xs">
          <div className="space-y-1">
            <label className="text-slate-500 font-bold uppercase text-[10px]">Filter Specific 8 PM Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:bg-white focus:outline-none"
            >
              <option value="">All Batches ({batches.length})</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} • {b.delivery_date}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Total Batches</div>
            <div className="text-2xl font-black text-slate-900 font-mono">{summary.total_batches || 0}</div>
            <div className="text-[10px] text-slate-400">Frozen at 8 PM cutoffs</div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Procurement Cost</div>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              ₹{Number(summary.total_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400">Actual mandi purchase spend</div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Usable vs Wastage Qty</div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {Number(summary.total_usable_qty || 0).toFixed(0)} <span className="text-xs text-rose-600 font-bold">(-{Number(summary.total_wastage_qty || 0).toFixed(0)})</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Purchased: {Number(summary.total_purchased_qty || 0).toFixed(0)} units
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Wastage Cost Impact</div>
            <div className="text-2xl font-black text-rose-700 font-mono">
              ₹{Number(summary.total_wastage_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400">Acquisition cost of sorted loss</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Procurement Line Items Breakdown ({items.length} items)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4">Batch</th>
                  <th className="p-4">Product</th>
                  <th className="p-4 text-right">Demand Qty</th>
                  <th className="p-4 text-right">Purchased Qty</th>
                  <th className="p-4 text-right">Received Qty</th>
                  <th className="p-4 text-right text-emerald-800">Usable Qty</th>
                  <th className="p-4 text-right text-rose-700">Wastage Qty</th>
                  <th className="p-4 text-right">Purchase Rate (₹)</th>
                  <th className="p-4 text-right font-black text-slate-900">Total Line Cost (₹)</th>
                  <th className="p-4">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                      No procurement items found for this period. Try changing the date filter to &quot;Today&quot; or &quot;This Month&quot;.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-slate-600 font-bold">{it.batch_number}</td>
                      <td className="p-4 font-sans font-bold text-slate-900">
                        {it.name_en} <span className="text-slate-400 font-normal">({it.name_gu})</span>
                      </td>
                      <td className="p-4 text-right text-slate-500">
                        {Number(it.total_demand_quantity).toFixed(1)} {it.unit_code}
                      </td>
                      <td className="p-4 text-right text-slate-700">
                        {Number(it.purchased_quantity).toFixed(1)} {it.unit_code}
                      </td>
                      <td className="p-4 text-right text-slate-700">
                        {Number(it.received_quantity).toFixed(1)}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-700">
                        {Number(it.usable_quantity).toFixed(1)}
                      </td>
                      <td className="p-4 text-right font-bold text-rose-600">
                        {Number(it.wastage_quantity).toFixed(1)}
                      </td>
                      <td className="p-4 text-right text-slate-700">
                        ₹{Number(it.actual_purchase_rate).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-black text-slate-900 text-sm">
                        ₹{Number(it.total_line_cost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-4 font-sans text-slate-600">{it.supplier_name || 'Mandi Spot'}</td>
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
