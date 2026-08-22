'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { Building2, Search, Download, RefreshCw, MapPin } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function SupplierReportingPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSupplierData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);

      const res = await fetch(`/api/reports/suppliers?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch supplier analytics');
      }

      setData(json.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error loading supplier reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSupplierData();
  }, [fetchSupplierData]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', 'suppliers');
      params.set('start_date', startDate);
      params.set('end_date', endDate);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taazatokra_suppliers_${startDate}_to_${endDate}.csv`;
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

  const rawSuppliers: any[] = data?.suppliers || [];
  const filteredSuppliers = rawSuppliers.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.supplier_name?.toLowerCase().includes(q) || s.contact_person?.toLowerCase().includes(q) || s.apmc_market_location?.toLowerCase().includes(q);
  });

  const totalPurchaseValue = filteredSuppliers.reduce((acc, s) => acc + Number(s.total_purchase_value || 0), 0);
  const totalPurchasedQty = filteredSuppliers.reduce((acc, s) => acc + Number(s.total_quantity_purchased || 0), 0);
  const totalWastageQty = filteredSuppliers.reduce((acc, s) => acc + Number(s.total_wastage_quantity || 0), 0);

  const handleDatePreset = (preset: 'today' | 'tomorrow' | 'this_week' | 'this_month' | '30days') => {
    const now = new Date();
    const format = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const today = format(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'tomorrow') {
      const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomStr = format(tom);
      setStartDate(tomStr);
      setEndDate(tomStr);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      setStartDate(format(monday));
      setEndDate(format(new Date()));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(new Date()));
    } else if (preset === '30days') {
      const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      setStartDate(format(past));
      setEndDate(format(new Date()));
    }
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
              <Building2 className="w-6 h-6 text-orange-600" />
              <span>Supplier & Mandi Performance (વેપારી રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              APMC Mandi procurement volume, average purchase rates, and supplier wastage ratios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSupplierData}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh report data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-600' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || rawSuppliers.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel CSV'}</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Presets Bar */}
        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-2xl gap-0.5 font-bold">
            <button
              type="button"
              onClick={() => handleDatePreset('today')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                startDate === endDate && startDate === new Date().toISOString().split('T')[0]
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('tomorrow')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                startDate === endDate && startDate !== new Date().toISOString().split('T')[0]
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('this_week')}
              className="px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('this_month')}
              className="px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              This Month (મહિનો)
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('30days')}
              className="px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              Last 30 Days
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2">
              <label className="text-slate-500 font-bold uppercase text-[10px]">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-slate-500 font-bold uppercase text-[10px]">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs text-xs">
          <div className="relative">
            <input
              type="text"
              placeholder="Search supplier name, mandi or contact person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none font-semibold text-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Aggregate KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              Total Purchase Value
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              ₹{totalPurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Paid across all mandi suppliers</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              Total Procured Units
            </div>
            <div className="text-3xl font-black text-orange-700 font-mono">
              {totalPurchasedQty.toFixed(1)} units
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Aggregate weight &amp; pieces</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              Reported Wastage
            </div>
            <div className="text-3xl font-black text-rose-700 font-mono">
              {totalWastageQty.toFixed(1)} units
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              {totalPurchasedQty > 0 ? `${((totalWastageQty / totalPurchasedQty) * 100).toFixed(1)}% wastage ratio` : '0%'}
            </div>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>{filteredSuppliers.length} Registered Suppliers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4">Supplier Name</th>
                  <th className="p-4">APMC Location</th>
                  <th className="p-4">Contact Person</th>
                  <th className="p-4 text-right">Batches</th>
                  <th className="p-4 text-right">Qty Purchased</th>
                  <th className="p-4 text-right font-black text-orange-800">Total Value (₹)</th>
                  <th className="p-4 text-right">Avg Rate (₹)</th>
                  <th className="p-4 text-right text-rose-700">Wastage Qty</th>
                  <th className="p-4">Last Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                      No suppliers found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => (
                    <tr key={s.supplier_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-sans font-bold text-slate-900">{s.supplier_name}</td>
                      <td className="p-4 text-slate-700 font-sans flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {s.apmc_market_location || 'Halol APMC'}
                      </td>
                      <td className="p-4 text-slate-500 font-sans">
                        {s.contact_person || '—'} {s.mobile ? `(${s.mobile})` : ''}
                      </td>
                      <td className="p-4 text-right text-slate-700">{s.total_batches}</td>
                      <td className="p-4 text-right text-slate-700">{Number(s.total_quantity_purchased).toFixed(1)}</td>
                      <td className="p-4 text-right font-black text-orange-700 text-sm">
                        ₹{Number(s.total_purchase_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-4 text-right text-slate-700">
                        ₹{Number(s.average_rate).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-bold text-rose-600">
                        {Number(s.total_wastage_quantity).toFixed(1)}
                      </td>
                      <td className="p-4 text-slate-500">{s.last_purchase_date || 'None'}</td>
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
