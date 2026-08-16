'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Search, 
  Calendar, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';
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
    } catch (err: any) {
      setError(err.message || 'Error loading product reports');
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
      a.download = `sabjiwala_products_${startDate}_to_${endDate}.csv`;
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

  const products: any[] = (data?.products || []).filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name_en?.toLowerCase().includes(q) || p.name_gu?.toLowerCase().includes(q);
  });

  const categories: any[] = data?.categories || [];
  const history: any[] = data?.history || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-purple-400" />
              <span>Product Sales & Margin Analysis (શાકભાજી નફો અને વેચાણ)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Historical quantities sold, realized selling prices vs estimated procurement costs, and margins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProductData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || products.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel CSV'}</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
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
            <label className="text-slate-400 font-bold uppercase text-[10px]">Category Filter</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSelectedProductId(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_en} ({c.name_gu})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Search Product</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search veg name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

        </div>

        {/* Selected Product History Panel */}
        {selectedProductId && history.length > 0 && (
          <div className="bg-slate-900 border border-purple-800/60 rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Price & Margin History Trend (Selected Product)</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="text-xs text-purple-400 hover:text-purple-300 font-bold"
              >
                Close History ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5 text-right">Quantity Sold</th>
                    <th className="p-2.5 text-right">Revenue (₹)</th>
                    <th className="p-2.5 text-right">Avg Selling Rate (₹)</th>
                    <th className="p-2.5 text-right">Avg Procurement Cost (₹)</th>
                    <th className="p-2.5 text-right font-bold text-emerald-400">Unit Margin (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {history.map((h, idx) => {
                    const unitMargin = Number(h.avg_selling_price) - Number(h.avg_cost);
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-2.5 text-white font-sans">{h.date_label}</td>
                        <td className="p-2.5 text-right text-purple-400 font-bold">{Number(h.quantity_sold).toFixed(1)}</td>
                        <td className="p-2.5 text-right text-slate-300">₹{Number(h.revenue).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-slate-300">₹{Number(h.avg_selling_price).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-slate-400">₹{Number(h.avg_cost).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-400">₹{unitMargin.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>{products.length} Products Sold in Selected Period</span>
            <span>Click row for daily history</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-right">Qty Sold</th>
                  <th className="p-3.5 text-right">Orders</th>
                  <th className="p-3.5 text-right">Net Sales (₹)</th>
                  <th className="p-3.5 text-right">Avg Sell Rate (₹)</th>
                  <th className="p-3.5 text-right">Avg Cost (₹)</th>
                  <th className="p-3.5 text-right font-bold text-emerald-400">Gross Contribution (₹)</th>
                  <th className="p-3.5 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {products.map((p) => {
                  const isSelected = selectedProductId === p.product_id;
                  return (
                    <tr
                      key={p.product_id}
                      onClick={() => setSelectedProductId(isSelected ? null : p.product_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-purple-950/40 font-bold' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-3.5 font-sans font-bold text-white flex items-center gap-2">
                        <span>{p.name_en}</span>
                        <span className="text-slate-400 text-[11px] font-normal">({p.name_gu})</span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-sans">{p.category_name_en}</td>
                      <td className="p-3.5 text-right text-purple-400 font-bold">
                        {Number(p.total_quantity_sold).toFixed(1)} {p.base_unit}
                      </td>
                      <td className="p-3.5 text-right text-slate-300">{p.total_orders}</td>
                      <td className="p-3.5 text-right font-bold text-white">
                        ₹{Number(p.net_sales).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3.5 text-right text-slate-300">
                        ₹{Number(p.average_selling_price).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right text-slate-400">
                        ₹{Number(p.average_cost).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-400 text-sm">
                        ₹{Number(p.gross_contribution).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-300">
                        {Number(p.margin_percentage).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
