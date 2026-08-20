'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { Truck, Download, RefreshCw, MapPin, Phone } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function DeliveryReportingPage() {
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

  const fetchDeliveryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);

      const res = await fetch(`/api/reports/delivery?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch delivery analytics');
      }

      setData(json.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error loading delivery reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDeliveryData();
  }, [fetchDeliveryData]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', 'delivery');
      params.set('start_date', startDate);
      params.set('end_date', endDate);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taazatokra_delivery_${startDate}_to_${endDate}.csv`;
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

  const metrics = data?.metrics || {};
  const areaBreakdown: any[] = data?.area_breakdown || [];
  const driverPerformance: any[] = data?.driver_performance || [];
  const settlements: any[] = data?.settlements || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-800 bg-rose-950/70 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </div>
        )}
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-cyan-400" />
              <span>Delivery & COD Settlement Report (ડિલિવરી અને રોકડ હિસાબ)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Halol neighborhood delivery performance, driver success rates, and driver cash reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDeliveryData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || driverPerformance.length === 0}
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

        {/* Delivery KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total Dispatched</div>
            <div className="text-2xl font-black text-white font-mono">{metrics.total_assigned || 0}</div>
            <div className="text-[10px] text-slate-500">Orders assigned to drivers</div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Delivery Success Rate</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {Number(metrics.success_rate || 0).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500">
              {metrics.delivered || 0} delivered, {metrics.failed || 0} failed
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">COD Cash Collected</div>
            <div className="text-2xl font-black text-white font-mono">
              ₹{Number(metrics.collected_cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-500">Physical currency collected</div>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Doorstep UPI Collected</div>
            <div className="text-2xl font-black text-cyan-400 font-mono">
              ₹{Number(metrics.collected_upi || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-500">Direct QR payment at doorstep</div>
          </div>
        </div>

        {/* Driver Performance Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Driver Performance Ledger ({driverPerformance.length} drivers)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Driver Name</th>
                  <th className="p-3.5">Mobile</th>
                  <th className="p-3.5 text-right">Assigned</th>
                  <th className="p-3.5 text-right text-emerald-400">Delivered</th>
                  <th className="p-3.5 text-right text-red-400">Failed</th>
                  <th className="p-3.5 text-right font-bold text-white">COD Collected (₹)</th>
                  <th className="p-3.5 text-right text-slate-300">Cash (₹)</th>
                  <th className="p-3.5 text-right text-cyan-400">UPI (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {driverPerformance.map((d) => (
                  <tr key={d.driver_id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-sans font-bold text-white">{d.driver_name}</td>
                    <td className="p-3.5 text-slate-400 font-sans flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" /> {d.driver_mobile || '—'}
                    </td>
                    <td className="p-3.5 text-right text-white font-bold">{d.total_assigned}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-400">{d.completed_deliveries}</td>
                    <td className="p-3.5 text-right font-bold text-red-400">{d.failed_deliveries}</td>
                    <td className="p-3.5 text-right font-black text-white text-sm">
                      ₹{Number(d.cod_collected).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3.5 text-right text-slate-300">
                      ₹{Number(d.cash_collected).toFixed(0)}
                    </td>
                    <td className="p-3.5 text-right text-cyan-400 font-bold">
                      ₹{Number(d.upi_collected).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Halol Neighborhoods Area Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Halol Area Delivery Breakdown ({areaBreakdown.length} areas)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Delivery Area</th>
                  <th className="p-3.5 text-right">Total Orders</th>
                  <th className="p-3.5 text-right text-emerald-400">Delivered</th>
                  <th className="p-3.5 text-right text-red-400">Failed</th>
                  <th className="p-3.5 text-right font-bold text-white">Total Revenue (₹)</th>
                  <th className="p-3.5 text-right">Average Order Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {areaBreakdown.map((a, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-sans font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" /> {a.area || 'Halol Central'}
                    </td>
                    <td className="p-3.5 text-right text-white font-bold">{a.total_orders}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-400">{a.delivered_count}</td>
                    <td className="p-3.5 text-right font-bold text-red-400">{a.failed_count}</td>
                    <td className="p-3.5 text-right font-black text-white text-sm">
                      ₹{Number(a.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3.5 text-right text-slate-300">
                      ₹{Number(a.average_order_value).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Driver Cash Settlements Ledger */}
        {settlements.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Driver Cash Settlement Handover Log</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Driver</th>
                    <th className="p-3.5 text-right">Expected Cash (₹)</th>
                    <th className="p-3.5 text-right">Handed Over (₹)</th>
                    <th className="p-3.5 text-right text-cyan-400">Doorstep UPI (₹)</th>
                    <th className="p-3.5 text-right font-bold">Discrepancy (₹)</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {settlements.map((s) => {
                    const hasDiscrepancy = Number(s.difference_amount) !== 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-3.5 text-white font-sans">{s.delivery_date}</td>
                        <td className="p-3.5 font-sans font-bold text-white">{s.driver_name}</td>
                        <td className="p-3.5 text-right text-slate-300">₹{Number(s.expected_cash_amount).toFixed(2)}</td>
                        <td className="p-3.5 text-right text-emerald-400 font-bold">₹{Number(s.handed_over_cash_amount || 0).toFixed(2)}</td>
                        <td className="p-3.5 text-right text-cyan-400">₹{Number(s.collected_upi_delivery_amount || 0).toFixed(2)}</td>
                        <td className={`p-3.5 text-right font-black ${hasDiscrepancy ? 'text-red-400' : 'text-slate-500'}`}>
                          {hasDiscrepancy ? `₹${Number(s.difference_amount).toFixed(2)}` : '₹0.00'}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            s.status === 'verified' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
