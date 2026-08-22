'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { TrendingUp, Package, Search, Download, RefreshCw } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function ProductReportingPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchProductData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (categoryId) params.set('category_id', categoryId);
      if (selectedProductId) params.set('product_id', selectedProductId);

      const res = await fetch(`/api/reports/products?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch product analytics');
      }

      setData(json.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error loading product reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, categoryId, selectedProductId]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', 'products');
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (categoryId) params.set('category_id', categoryId);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taazatokra_products_${startDate}_to_${endDate}.csv`;
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

  const products: any[] = (data?.products || []).filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name_en?.toLowerCase().includes(q) || p.name_gu?.toLowerCase().includes(q);
  });

  const categories: any[] = data?.categories || [];
  const history: any[] = data?.history || [];

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
              <Package className="w-6 h-6 text-purple-600" />
              <span>Product Sales & Margin Analysis (શાકભાજી નફો અને વેચાણ)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Historical quantities sold, realized selling prices vs estimated procurement costs, and product margins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProductData}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh report data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || products.length === 0}
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

        {/* Secondary Filters Bar: Category & Search */}
        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-500 font-bold uppercase text-[10px]">Filter By Category</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSelectedProductId(null);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:bg-white focus:outline-none"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_en} ({c.name_gu})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-500 font-bold uppercase text-[10px]">Search Product Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search veg or fruit name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none text-xs font-semibold"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Selected Product History Panel */}
        {selectedProductId && history.length > 0 && (
          <div className="bg-purple-50/60 border border-purple-200 rounded-3xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-purple-200 pb-3">
              <h3 className="text-xs font-extrabold text-purple-950 tracking-wider uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-700" />
                <span>Price & Margin History Trend (Selected Product)</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="text-xs text-purple-700 hover:text-purple-900 font-bold bg-white px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs cursor-pointer"
              >
                Close History ✕
              </button>
            </div>

            <div className="overflow-x-auto bg-white rounded-2xl border border-purple-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 text-right">Quantity Sold</th>
                    <th className="p-3.5 text-right">Revenue (₹)</th>
                    <th className="p-3.5 text-right">Avg Selling Rate (₹)</th>
                    <th className="p-3.5 text-right">Avg Procurement Cost (₹)</th>
                    <th className="p-3.5 text-right font-bold text-emerald-800">Unit Margin (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {history.map((h, idx) => {
                    const unitMargin = Number(h.avg_selling_price) - Number(h.avg_cost);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 text-slate-900 font-sans font-bold">{h.date_label}</td>
                        <td className="p-3.5 text-right text-purple-700 font-bold">{Number(h.quantity_sold).toFixed(1)}</td>
                        <td className="p-3.5 text-right text-slate-700">₹{Number(h.revenue).toFixed(2)}</td>
                        <td className="p-3.5 text-right text-slate-700">₹{Number(h.avg_selling_price).toFixed(2)}</td>
                        <td className="p-3.5 text-right text-slate-500">₹{Number(h.avg_cost).toFixed(2)}</td>
                        <td className="p-3.5 text-right font-bold text-emerald-700">₹{unitMargin.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>{products.length} Products Sold in Selected Period</span>
            <span className="text-[11px] text-slate-400 font-normal">Click row for daily trend</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-right">Qty Sold</th>
                  <th className="p-4 text-right">Orders</th>
                  <th className="p-4 text-right">Net Sales (₹)</th>
                  <th className="p-4 text-right">Avg Sell Rate (₹)</th>
                  <th className="p-4 text-right">Avg Cost (₹)</th>
                  <th className="p-4 text-right font-black text-emerald-800">Gross Contribution (₹)</th>
                  <th className="p-4 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                      No product sales recorded for this period. Try changing date filter to &quot;Today&quot; or &quot;This Month&quot;.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isSelected = selectedProductId === p.product_id;
                    return (
                      <tr
                        key={p.product_id}
                        onClick={() => setSelectedProductId(isSelected ? null : p.product_id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-purple-50 font-bold' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-4 font-sans font-bold text-slate-900 flex items-center gap-2">
                          <span>{p.name_en}</span>
                          <span className="text-slate-400 text-[11px] font-normal">({p.name_gu})</span>
                        </td>
                        <td className="p-4 text-slate-500 font-sans">{p.category_name_en}</td>
                        <td className="p-4 text-right text-purple-700 font-bold">
                          {Number(p.total_quantity_sold).toFixed(1)} {p.base_unit}
                        </td>
                        <td className="p-4 text-right text-slate-700">{p.total_orders}</td>
                        <td className="p-4 text-right font-bold text-slate-900">
                          ₹{Number(p.net_sales).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-4 text-right text-slate-700">
                          ₹{Number(p.average_selling_price).toFixed(2)}
                        </td>
                        <td className="p-4 text-right text-slate-500">
                          ₹{Number(p.average_cost).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-black text-emerald-700 text-sm">
                          ₹{Number(p.gross_contribution).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-700">
                          {Number(p.margin_percentage).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
