'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Boxes, 
  Search, 
  Calendar, 
  Download, 
  RefreshCw, 
  Layers, 
  PackageX, 
  CheckCircle2, 
  DollarSign,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function ProcurementReportingPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
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
    } catch (err: any) {
      setError(err.message || 'Error loading procurement reports');
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
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary || {};
  const batches: any[] = data?.batches || [];
  const items: any[] = data?.items || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Boxes className="w-6 h-6 text-emerald-400" />
              <span>Procurement & Wastage Analysis (ખરીદી અને બગાડ રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              8 PM batch frozen demand vs actual mandi purchases, receiving weights, usable quantities, and wastage costs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProcurementData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || items.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel CSV'}</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Batch Selector */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Filter Specific Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
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
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total Batches</div>
            <div className="text-2xl font-black text-white font-mono">{summary.total_batches || 0}</div>
            <div className="text-[10px] text-slate-500">Frozen at 8 PM cutoffs</div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Procurement Cost</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              ₹{Number(summary.total_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-500">Actual mandi purchase spend</div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Usable vs Wastage Qty</div>
            <div className="text-2xl font-black text-white font-mono">
              {Number(summary.total_usable_qty || 0).toFixed(0)} <span className="text-xs text-red-400 font-bold">(-{Number(summary.total_wastage_qty || 0).toFixed(0)})</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Purchased: {Number(summary.total_purchased_qty || 0).toFixed(0)} units
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Wastage Cost Impact</div>
            <div className="text-2xl font-black text-red-400 font-mono">
              ₹{Number(summary.total_wastage_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-500">Acquisition cost of sorted loss</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Procurement Line Items Breakdown ({items.length} items)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Batch</th>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5 text-right">Demand Qty</th>
                  <th className="p-3.5 text-right">Purchased Qty</th>
                  <th className="p-3.5 text-right">Received Qty</th>
                  <th className="p-3.5 text-right text-emerald-400">Usable Qty</th>
                  <th className="p-3.5 text-right text-red-400">Wastage Qty</th>
                  <th className="p-3.5 text-right">Purchase Rate (₹)</th>
                  <th className="p-3.5 text-right font-bold text-white">Total Line Cost (₹)</th>
                  <th className="p-3.5">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 text-slate-400 font-bold">{it.batch_number}</td>
                    <td className="p-3.5 font-sans font-bold text-white">
                      {it.name_en} <span className="text-slate-400 font-normal">({it.name_gu})</span>
                    </td>
                    <td className="p-3.5 text-right text-slate-400">
                      {Number(it.total_demand_quantity).toFixed(1)} {it.unit_code}
                    </td>
                    <td className="p-3.5 text-right text-slate-300">
                      {Number(it.purchased_quantity).toFixed(1)} {it.unit_code}
                    </td>
                    <td className="p-3.5 text-right text-slate-300">
                      {Number(it.received_quantity).toFixed(1)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-emerald-400">
                      {Number(it.usable_quantity).toFixed(1)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-red-400">
                      {Number(it.wastage_quantity).toFixed(1)}
                    </td>
                    <td className="p-3.5 text-right text-slate-300">
                      ₹{Number(it.actual_purchase_rate).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-black text-white text-sm">
                      ₹{Number(it.total_line_cost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3.5 font-sans text-slate-300">{it.supplier_name || 'Mandi Spot'}</td>
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
