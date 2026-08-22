'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { ShoppingBag, Search, Download, RefreshCw, ChevronDown, ChevronUp, MapPin, Phone } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { ReportDatePresetsBar, computePresetDates, DatePresetType } from '@/components/admin/ReportDatePresetsBar';

export default function OrdersReportPage() {
  const [activePreset, setActivePreset] = useState<DatePresetType>('this_week');
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
    } catch (err) {
      setError(getErrorMessage(err) || 'Error fetching orders');
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
    } catch (err) {
      alert(`Export error: ${getErrorMessage(err)}`);
    } finally {
      setExporting(false);
    }
  };

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
              <ShoppingBag className="w-6 h-6 text-emerald-600" />
              <span>Customer Orders Detailed Report (ઓર્ડર્સ રિપોર્ટ)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Complete historical order snapshots, item quantities, discounts &amp; delivery addresses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh report data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || orders.length === 0}
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


        {/* Secondary Filters Bar: Status, Area & Search */}
        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          
          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-slate-500 font-bold uppercase text-[10px]">Filter By Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:bg-white focus:outline-none"
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
            <label className="text-slate-500 font-bold uppercase text-[10px]">Halol Area</label>
            <input
              type="text"
              placeholder="e.g. Anand Nagar"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none font-semibold"
            />
          </div>

          {/* Search */}
          <div className="space-y-1">
            <label className="text-slate-500 font-bold uppercase text-[10px]">Search (Order/Customer/Mobile)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none font-semibold"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

        </div>

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Found {totalCount} matching orders</span>
            <span className="text-[11px] text-slate-400 font-normal">Displaying up to 100 entries</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs italic">
              No orders found matching the chosen filters. Try selecting &quot;Today&quot; or &quot;This Month&quot;.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const totalDiscounts = (Number(o.first500_discount_amount || 0) + Number(o.cod_discount_amount || 0));

                return (
                  <div key={o.id} className="p-5 hover:bg-slate-50/80 transition-colors">
                    
                    {/* Primary Order Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      
                      {/* Left: Number, Customer & Area */}
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-emerald-700 text-sm">
                            {o.order_number}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            o.order_status === 'delivered' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : o.order_status === 'failed_delivery'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {o.order_status}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {o.delivery_date} ({o.delivery_slot_start?.slice(0, 5)} - {o.delivery_slot_end?.slice(0, 5)})
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-slate-700 font-medium">
                          <span className="font-bold text-slate-900">{o.customer_name_snapshot}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" /> {o.customer_mobile_snapshot}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" /> {o.delivery_area_snapshot}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amounts & Expand Button */}
                      <div className="flex items-center space-x-4">
                        <div className="text-right font-mono">
                          <div className="text-sm font-black text-slate-900">
                            ₹{Number(o.final_payable_amount).toFixed(2)}
                          </div>
                          {totalDiscounts > 0 && (
                            <div className="text-[10px] text-amber-700 font-semibold">
                              (Subtotal: ₹{Number(o.subtotal_amount).toFixed(0)} • Disc: -₹{totalDiscounts.toFixed(0)})
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-slate-50 p-4 rounded-2xl">
                        
                        {/* Delivery Address */}
                        <div className="text-xs space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            Full Delivery Address:
                          </span>
                          <p className="text-slate-800 font-medium">
                            {o.delivery_flat_house_snapshot}, {o.delivery_society_street_snapshot}, {o.delivery_landmark_snapshot}, Halol - {o.delivery_area_snapshot}
                          </p>
                        </div>

                        {/* Items Snapshot Table */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            Line Items Snapshot ({o.items?.length || 0} items):
                          </span>

                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                                <tr>
                                  <th className="p-3">Product</th>
                                  <th className="p-3">Variant</th>
                                  <th className="p-3">Qty Ordered</th>
                                  <th className="p-3">Rate (₹)</th>
                                  <th className="p-3 text-right">Line Total (₹)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono">
                                {(o.items || []).map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3 font-sans font-semibold text-slate-900">
                                      {item.product_name_en} <span className="text-slate-400 font-normal">({item.product_name_gu})</span>
                                    </td>
                                    <td className="p-3 text-slate-600 font-sans">{item.variant_name_en}</td>
                                    <td className="p-3 text-emerald-700 font-bold">
                                      {item.quantity} ({item.base_quantity} {item.unit_code})
                                    </td>
                                    <td className="p-3 text-slate-700">₹{Number(item.selling_price).toFixed(2)}</td>
                                    <td className="p-3 text-right font-black text-slate-900">₹{Number(item.final_amount).toFixed(2)}</td>
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
