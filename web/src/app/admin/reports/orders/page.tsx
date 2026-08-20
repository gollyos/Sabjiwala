'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Calendar, 
  Download, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Phone,
  FileText
} from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function OrdersReportPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (status) params.set('status', status);
      if (area) params.set('area', area);
      if (search) params.set('search', search);
      params.set('limit', '100');

      const res = await fetch(`/api/reports/orders?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch orders');
      }

      setOrders(json.data?.orders || []);
      setTotalCount(json.data?.total_count || 0);
    } catch (err: any) {
      setError(err.message || 'Error fetching orders');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, status, area, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', 'orders');
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (status) params.set('status', status);
      if (area) params.set('area', area);
      if (search) params.set('search', search);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taazatokra_orders_${startDate}_to_${endDate}.csv`;
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-emerald-400" />
              <span>Customer Orders Detailed Report (ઓર્ડર્સ રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Complete historical order snapshots, item quantities, discounts & delivery addresses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || orders.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel CSV'}</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          
          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Start Delivery Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">End Delivery Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Order Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="packed">Packed</option>
              <option value="out_for_delivery">Out For Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="failed_delivery">Failed Delivery</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Area Filter */}
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Halol Area</label>
            <input
              type="text"
              placeholder="e.g. Anand Nagar"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          {/* Search */}
          <div className="space-y-1">
            <label className="text-slate-400 font-bold uppercase text-[10px]">Search (Order/Customer/Mobile)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

        </div>

        {/* Orders Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Found {totalCount} matching orders</span>
            <span>Displaying up to 100 entries</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic">
              No orders found matching the chosen filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const totalDiscounts = (Number(o.first500_discount_amount || 0) + Number(o.cod_discount_amount || 0));

                return (
                  <div key={o.id} className="p-4 hover:bg-slate-800/40 transition-colors">
                    
                    {/* Primary Order Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      
                      {/* Left: Number, Customer & Area */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-emerald-400 text-sm">
                            {o.order_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            o.order_status === 'delivered' 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : o.order_status === 'failed_delivery'
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}>
                            {o.order_status}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {o.delivery_date} ({o.delivery_slot_start?.slice(0, 5)} - {o.delivery_slot_end?.slice(0, 5)})
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-slate-300 font-medium">
                          <span>{o.customer_name_snapshot}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3" /> {o.customer_mobile_snapshot}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" /> {o.delivery_area_snapshot}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amounts & Expand Button */}
                      <div className="flex items-center space-x-4">
                        <div className="text-right font-mono">
                          <div className="text-sm font-black text-white">
                            ₹{Number(o.final_payable_amount).toFixed(2)}
                          </div>
                          {totalDiscounts > 0 && (
                            <div className="text-[10px] text-amber-400">
                              (Subtotal: ₹{Number(o.subtotal_amount).toFixed(0)} • Disc: -₹{totalDiscounts.toFixed(0)})
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3 bg-slate-950/60 p-4 rounded-2xl">
                        
                        {/* Delivery Address */}
                        <div className="text-xs space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            Full Delivery Address:
                          </span>
                          <p className="text-slate-300">
                            {o.delivery_flat_house_snapshot}, {o.delivery_society_street_snapshot}, {o.delivery_landmark_snapshot}, Halol - {o.delivery_area_snapshot}
                          </p>
                        </div>

                        {/* Items Snapshot Table */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            Immutable Line Items Snapshot ({o.items?.length || 0} items):
                          </span>

                          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                                <tr>
                                  <th className="p-2.5">Product</th>
                                  <th className="p-2.5">Variant</th>
                                  <th className="p-2.5">Qty Ordered</th>
                                  <th className="p-2.5">Rate (₹)</th>
                                  <th className="p-2.5 text-right">Line Total (₹)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 font-mono">
                                {(o.items || []).map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-800/30">
                                    <td className="p-2.5 font-sans font-semibold text-white">
                                      {item.product_name_en} <span className="text-slate-400 font-normal">({item.product_name_gu})</span>
                                    </td>
                                    <td className="p-2.5 text-slate-300 font-sans">{item.variant_name_en}</td>
                                    <td className="p-2.5 text-emerald-400 font-bold">
                                      {item.quantity} ({item.base_quantity} {item.unit_code})
                                    </td>
                                    <td className="p-2.5 text-slate-300">₹{Number(item.selling_price).toFixed(2)}</td>
                                    <td className="p-2.5 text-right font-black text-white">₹{Number(item.final_amount).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
