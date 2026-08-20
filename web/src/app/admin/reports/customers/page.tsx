'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { Users, Search, Download, RefreshCw, Gift, Phone, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';

export default function CustomerReportingPage() {
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
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      params.set('limit', '100');

      const res = await fetch(`/api/reports/customers?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch customer analytics');
      }

      setData(json.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error loading customer reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('type', 'customers');
      params.set('start_date', startDate);
      params.set('end_date', endDate);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taazatokra_customers_${startDate}_to_${endDate}.csv`;
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
  const first500 = data?.first500 || {};
  const rawCustomers: any[] = data?.customers || [];

  const filteredCustomers = rawCustomers.filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.full_name?.toLowerCase().includes(q) || c.mobile?.includes(q);
  });

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
              <Users className="w-6 h-6 text-amber-400" />
              <span>Customer Insights & FIRST500 Campaign (ગ્રાહક વિશ્લેષણ)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Customer cohort retention, verified sequence numbers, and strict 500-customer promotional burn tracker.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchCustomerData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || rawCustomers.length === 0}
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
            <label className="text-slate-400 font-bold uppercase text-[10px]">Search Customer</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Cohort KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              Total Registered Customers
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {metrics.total_customers || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Active customer database in Halol</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              New Ordering Customers
            </div>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              {metrics.new_customers || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">First order placed in this period</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              Repeat Ordering Customers
            </div>
            <div className="text-3xl font-black text-blue-400 font-mono">
              {metrics.repeat_customers || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Returning customer orders in this period</div>
          </div>
        </div>

        {/* FIRST500 Campaign Status Box */}
        <div className="bg-slate-900 border border-amber-800/50 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-400" />
              <span>FIRST500 Campaign Performance (પ્રથમ ૫૦૦ ગ્રાહક યોજના)</span>
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400">
              500 Quota Cap
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Consumed Coupons</div>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {first500.consumed_count || 0} / 500
              </div>
              <div className="text-[10px] text-slate-500">Completed & delivered</div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Reserved (Pending)</div>
              <div className="text-xl font-black text-amber-400 font-mono">
                {first500.reserved_count || 0}
              </div>
              <div className="text-[10px] text-slate-500">In-flight active orders</div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Remaining Eligible</div>
              <div className="text-xl font-black text-white font-mono">
                {first500.remaining_eligible || 0}
              </div>
              <div className="text-[10px] text-slate-500">Unused coupons remaining</div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Discount Burn</div>
              <div className="text-xl font-black text-amber-300 font-mono">
                ₹{Number(first500.total_discount_given || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400">
                Revenue Gen: ₹{Number(first500.revenue_from_first500 || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Customer Drilldown Drawer */}
        {selectedCustomer && (
          <div className="bg-slate-900 border border-amber-500/60 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="font-extrabold text-sm text-white">
                  Customer Profile: {selectedCustomer.full_name}
                </span>
                <span className="text-xs font-mono bg-slate-950 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800">
                  Seq #{selectedCustomer.verified_sequence || '—'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Mobile</span>
                <div className="font-mono font-bold text-white mt-1">{selectedCustomer.mobile}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Orders</span>
                <div className="font-mono font-bold text-white mt-1">{selectedCustomer.total_orders}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Lifetime Spend</span>
                <div className="font-mono font-bold text-emerald-400 mt-1">₹{Number(selectedCustomer.lifetime_spend).toFixed(2)}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Average Order Value</span>
                <div className="font-mono font-bold text-white mt-1">₹{Number(selectedCustomer.average_order_value).toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={`/admin/reports/orders?search=${selectedCustomer.mobile}`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>View All Orders for this Customer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Customer Rankings Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Customer Lifetime Value (LTV) Ranking</span>
            <span>{filteredCustomers.length} Customers • Click row to inspect profile</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                <tr>
                  <th className="p-3.5">Seq #</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Mobile</th>
                  <th className="p-3.5 text-right">Total Orders</th>
                  <th className="p-3.5 text-right font-bold text-emerald-400">Lifetime Spend (₹)</th>
                  <th className="p-3.5 text-right">Average Order Value (₹)</th>
                  <th className="p-3.5">Last Order Date</th>
                  <th className="p-3.5 text-center">FIRST500</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredCustomers.map((c) => {
                  const isSelected = selectedCustomer?.customer_id === c.customer_id;
                  return (
                    <tr
                      key={c.customer_id}
                      onClick={() => setSelectedCustomer(isSelected ? null : c)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-amber-950/40 font-bold' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-3.5 text-slate-400">#{c.verified_sequence || '—'}</td>
                      <td className="p-3.5 font-sans font-bold text-white">{c.full_name}</td>
                      <td className="p-3.5 text-slate-300 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" /> {c.mobile}
                      </td>
                      <td className="p-3.5 text-right font-bold text-white">{c.total_orders}</td>
                      <td className="p-3.5 text-right font-black text-emerald-400 text-sm">
                        ₹{Number(c.lifetime_spend).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3.5 text-right text-slate-300">
                        ₹{Number(c.average_order_value).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-slate-400">{c.last_order_date || 'No orders'}</td>
                      <td className="p-3.5 text-center">
                        {c.first500_consumed ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold uppercase">
                            Used
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Unused</span>
                        )}
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
