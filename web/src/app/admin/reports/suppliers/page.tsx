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
              <Building2 className="w-6 h-6 text-orange-400" />
              <span>Supplier & Mandi Performance (વેપારી રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              APMC Mandi procurement volume, average purchase rates, and supplier wastage ratios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSupplierData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || rawSuppliers.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel CSV'}</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Search */}
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
            <label className="text-slate-400 font-bold uppercase text-[10px]">Search Supplier</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name, mandi or contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Aggregate KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              Total Purchase Value
            </div>
            <div className="text-3xl font-black text-white font-mono">
              ₹{totalPurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Paid across all mandi suppliers</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              Total Procured Units
            </div>
            <div className="text-3xl font-black text-orange-400 font-mono">
              {totalPurchasedQty.toFixed(1)} units
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Aggregate weight & pieces</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              Reported Wastage
            </div>
            <div className="text-3xl font-black text-red-400 font-mono">
              {totalWastageQty.toFixed(1)} units
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              {totalPurchasedQty > 0 ? `${((totalWastageQty / totalPurchasedQty) * 100).toFixed(1)}% wastage ratio` : '0%'}
            </div>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>{filteredSuppliers.length} Registered Suppliers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Supplier Name</th>
                  <th className="p-3.5">APMC Location</th>
                  <th className="p-3.5">Contact Person</th>
                  <th className="p-3.5 text-right">Batches</th>
                  <th className="p-3.5 text-right">Qty Purchased</th>
                  <th className="p-3.5 text-right font-bold text-orange-400">Total Value (₹)</th>
                  <th className="p-3.5 text-right">Avg Rate (₹)</th>
                  <th className="p-3.5 text-right text-red-400">Wastage Qty</th>
                  <th className="p-3.5">Last Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredSuppliers.map((s) => (
                  <tr key={s.supplier_id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-sans font-bold text-white">{s.supplier_name}</td>
                    <td className="p-3.5 text-slate-300 font-sans flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" /> {s.apmc_market_location || 'Halol APMC'}
                    </td>
                    <td className="p-3.5 text-slate-400 font-sans">
                      {s.contact_person || '—'} {s.mobile ? `(${s.mobile})` : ''}
                    </td>
                    <td className="p-3.5 text-right text-slate-300">{s.total_batches}</td>
                    <td className="p-3.5 text-right text-slate-300">{Number(s.total_quantity_purchased).toFixed(1)}</td>
                    <td className="p-3.5 text-right font-black text-orange-400 text-sm">
                      ₹{Number(s.total_purchase_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3.5 text-right text-slate-300">
                      ₹{Number(s.average_rate).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-red-400">
                      {Number(s.total_wastage_quantity).toFixed(1)}
                    </td>
                    <td className="p-3.5 text-slate-400">{s.last_purchase_date || 'None'}</td>
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
