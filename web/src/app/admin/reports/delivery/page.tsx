'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { Truck, Download, RefreshCw, MapPin, Phone } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { ReportDatePresetsBar, computePresetDates, DatePresetType } from '@/components/admin/ReportDatePresetsBar';
import { addDaysIST, todayIST } from '@/lib/istDate';

export default function DeliveryReportingPage() {
  const [activePreset, setActivePreset] = useState<DatePresetType>('30days');
  const [startDate, setStartDate] = useState(() => {
    return addDaysIST(-29);
  });
  const [endDate, setEndDate] = useState(() => todayIST());
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
      a.download = `tajitokri_delivery_${startDate}_to_${endDate}.csv`;
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
              <Truck className="w-6 h-6 text-cyan-600" />
              <span>Delivery &amp; COD Settlement Report (ડિલિવરી અને રોકડ હિસાબ)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Halol neighborhood delivery performance, driver success rates, and driver cash reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDeliveryData}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh report data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || driverPerformance.length === 0}
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


        {/* Delivery KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Total Dispatched</div>
            <div className="text-2xl font-black text-slate-900 font-mono">{metrics.total_assigned || 0}</div>
            <div className="text-[10px] text-slate-400">Orders assigned to drivers</div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Delivery Success Rate</div>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              {Number(metrics.success_rate || 0).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400">
              {metrics.delivered || 0} delivered, {metrics.failed || 0} failed
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">COD Cash Collected</div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₹{Number(metrics.collected_cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400">Physical currency collected</div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Doorstep UPI Collected</div>
            <div className="text-2xl font-black text-cyan-700 font-mono">
              ₹{Number(metrics.collected_upi || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400">Direct QR payment at doorstep</div>
          </div>
        </div>

        {/* Driver Performance Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Driver Performance Ledger ({driverPerformance.length} drivers)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4">Driver Name</th>
                  <th className="p-4">Mobile</th>
                  <th className="p-4 text-right">Assigned</th>
                  <th className="p-4 text-right text-emerald-800">Delivered</th>
                  <th className="p-4 text-right text-rose-700">Failed</th>
                  <th className="p-4 text-right font-black text-slate-900">COD Collected (₹)</th>
                  <th className="p-4 text-right text-slate-700">Cash (₹)</th>
                  <th className="p-4 text-right text-cyan-700">UPI (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {driverPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                      No driver delivery runs recorded for this period. Try changing date filter to &quot;Today&quot; or &quot;This Month&quot;.
                    </td>
                  </tr>
                ) : (
                  driverPerformance.map((d) => (
                    <tr key={d.driver_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-sans font-bold text-slate-900">{d.driver_name}</td>
                      <td className="p-4 text-slate-500 font-sans flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" /> {d.driver_mobile || '—'}
                      </td>
                      <td className="p-4 text-right text-slate-900 font-bold">{d.total_assigned}</td>
                      <td className="p-4 text-right font-bold text-emerald-700">{d.completed_deliveries}</td>
                      <td className="p-4 text-right font-bold text-rose-600">{d.failed_deliveries}</td>
                      <td className="p-4 text-right font-black text-slate-900 text-sm">
                        ₹{Number(d.cod_collected).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-4 text-right text-slate-700">
                        ₹{Number(d.cash_collected).toFixed(0)}
                      </td>
                      <td className="p-4 text-right text-cyan-700 font-bold">
                        ₹{Number(d.upi_collected).toFixed(0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Halol Neighborhoods Area Breakdown */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Halol Area Delivery Breakdown ({areaBreakdown.length} areas)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4">Delivery Area</th>
                  <th className="p-4 text-right">Total Orders</th>
                  <th className="p-4 text-right text-emerald-800">Delivered</th>
                  <th className="p-4 text-right text-rose-700">Failed</th>
                  <th className="p-4 text-right font-black text-slate-900">Total Revenue (₹)</th>
                  <th className="p-4 text-right">Average Order Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {areaBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                      No area deliveries recorded for this period.
                    </td>
                  </tr>
                ) : (
                  areaBreakdown.map((a, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-sans font-bold text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {a.area || 'Halol Central'}
                      </td>
                      <td className="p-4 text-right text-slate-900 font-bold">{a.total_orders}</td>
                      <td className="p-4 text-right font-bold text-emerald-700">{a.delivered_count}</td>
                      <td className="p-4 text-right font-bold text-rose-600">{a.failed_count}</td>
                      <td className="p-4 text-right font-black text-slate-900 text-sm">
                        ₹{Number(a.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-4 text-right text-slate-700">
                        ₹{Number(a.average_order_value).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Driver Cash Settlements Ledger */}
        {settlements.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Driver Cash Settlement Handover Log</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Driver</th>
                    <th className="p-4 text-right">Expected Cash (₹)</th>
                    <th className="p-4 text-right">Handed Over (₹)</th>
                    <th className="p-4 text-right text-cyan-700">Doorstep UPI (₹)</th>
                    <th className="p-4 text-right font-bold">Discrepancy (₹)</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {settlements.map((s) => {
                    const hasDiscrepancy = Number(s.difference_amount) !== 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 text-slate-900 font-sans font-bold">{s.delivery_date}</td>
                        <td className="p-4 font-sans font-bold text-slate-900">{s.driver_name}</td>
                        <td className="p-4 text-right text-slate-700">₹{Number(s.expected_cash_amount).toFixed(2)}</td>
                        <td className="p-4 text-right text-emerald-700 font-bold">₹{Number(s.handed_over_cash_amount || 0).toFixed(2)}</td>
                        <td className="p-4 text-right text-cyan-700">₹{Number(s.collected_upi_delivery_amount || 0).toFixed(2)}</td>
                        <td className={`p-4 text-right font-black ${hasDiscrepancy ? 'text-rose-600' : 'text-slate-400'}`}>
                          {hasDiscrepancy ? `₹${Number(s.difference_amount).toFixed(2)}` : '₹0.00'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            s.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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
