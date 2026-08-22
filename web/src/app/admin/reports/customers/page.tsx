'use client';

import { getErrorMessage } from '@/lib/errors';
import { useState, useCallback, useEffect } from 'react';
import { Users, Search, Download, RefreshCw, Gift, Phone, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { ReportDatePresetsBar, computePresetDates, DatePresetType } from '@/components/admin/ReportDatePresetsBar';
import { addDaysIST, todayIST } from '@/lib/istDate';

export default function CustomerReportingPage() {
  const [activePreset, setActivePreset] = useState<DatePresetType>('30days');
  const [startDate, setStartDate] = useState(() => {
    return addDaysIST(-29);
  });
  const [endDate, setEndDate] = useState(() => todayIST());
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
              <Users className="w-6 h-6 text-amber-600" />
              <span>Customer Insights &amp; FIRST500 Campaign (ગ્રાહક વિશ્લેષણ)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Customer cohort retention, verified sequence numbers, and strict 500-customer promotional burn tracker.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchCustomerData}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Refresh report data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || rawCustomers.length === 0}
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


        {/* Customer Search Bar */}
        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs text-xs">
          <div className="relative">
            <input
              type="text"
              placeholder="Search customer by name or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none font-semibold text-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Cohort KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              Total Registered Customers
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {metrics.total_customers || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Active customer database in Halol</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              New Ordering Customers
            </div>
            <div className="text-3xl font-black text-emerald-700 font-mono">
              {metrics.new_customers || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-2">First order placed in this period</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              Repeat Ordering Customers
            </div>
            <div className="text-3xl font-black text-blue-700 font-mono">
              {metrics.repeat_customers || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Returning customer orders in this period</div>
          </div>
        </div>

        {/* FIRST500 Campaign Status Box */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3">
            <h3 className="text-xs font-extrabold text-amber-950 tracking-wider uppercase flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-700" />
              <span>FIRST500 Campaign Performance (પ્રથમ ૫૦૦ ગ્રાહક યોજના)</span>
            </h3>
            <span className="text-xs font-mono font-bold text-amber-800 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
              500 Quota Cap
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-white border border-amber-100 rounded-2xl space-y-1 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Consumed Coupons</div>
              <div className="text-xl font-black text-emerald-700 font-mono">
                {first500.consumed_count || 0} / 500
              </div>
              <div className="text-[10px] text-slate-400">Completed &amp; delivered</div>
            </div>

            <div className="p-4 bg-white border border-amber-100 rounded-2xl space-y-1 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Reserved (Pending)</div>
              <div className="text-xl font-black text-amber-700 font-mono">
                {first500.reserved_count || 0}
              </div>
              <div className="text-[10px] text-slate-400">In-flight active orders</div>
            </div>

            <div className="p-4 bg-white border border-amber-100 rounded-2xl space-y-1 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Remaining Eligible</div>
              <div className="text-xl font-black text-slate-900 font-mono">
                {first500.remaining_eligible || 0}
              </div>
              <div className="text-[10px] text-slate-400">Unused coupons remaining</div>
            </div>

            <div className="p-4 bg-white border border-amber-100 rounded-2xl space-y-1 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Total Discount Burn</div>
              <div className="text-xl font-black text-amber-800 font-mono">
                ₹{Number(first500.total_discount_given || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400">
                Revenue: ₹{Number(first500.revenue_from_first500 || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Customer Drilldown Drawer */}
        {selectedCustomer && (
          <div className="bg-white border border-amber-300 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="font-extrabold text-sm text-slate-900">
                  Customer Profile: {selectedCustomer.full_name}
                </span>
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  Seq #{selectedCustomer.verified_sequence || '—'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-xs text-amber-700 hover:text-amber-900 font-bold cursor-pointer bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Mobile</span>
                <div className="font-mono font-bold text-slate-900 mt-1">{selectedCustomer.mobile}</div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Orders</span>
                <div className="font-mono font-bold text-slate-900 mt-1">{selectedCustomer.total_orders}</div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Lifetime Spend</span>
                <div className="font-mono font-bold text-emerald-700 mt-1">₹{Number(selectedCustomer.lifetime_spend).toFixed(2)}</div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Average Order Value</span>
                <div className="font-mono font-bold text-slate-900 mt-1">₹{Number(selectedCustomer.average_order_value).toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={`/admin/reports/orders?search=${selectedCustomer.mobile}`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
              >
                <span>View All Orders for this Customer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Customer Rankings Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Customer Lifetime Value (LTV) Ranking</span>
            <span className="text-[11px] text-slate-400 font-normal">{filteredCustomers.length} Customers • Click row to inspect profile</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4">Seq #</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Mobile</th>
                  <th className="p-4 text-right">Total Orders</th>
                  <th className="p-4 text-right font-black text-emerald-800">Lifetime Spend (₹)</th>
                  <th className="p-4 text-right">Average Order Value (₹)</th>
                  <th className="p-4">Last Order Date</th>
                  <th className="p-4 text-center">FIRST500</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                      No customers found matching the search filter.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const isSelected = selectedCustomer?.customer_id === c.customer_id;
                    return (
                      <tr
                        key={c.customer_id}
                        onClick={() => setSelectedCustomer(isSelected ? null : c)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50 font-bold' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-4 text-slate-500">#{c.verified_sequence || '—'}</td>
                        <td className="p-4 font-sans font-bold text-slate-900">{c.full_name}</td>
                        <td className="p-4 text-slate-600 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {c.mobile}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900">{c.total_orders}</td>
                        <td className="p-4 text-right font-black text-emerald-700 text-sm">
                          ₹{Number(c.lifetime_spend).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-4 text-right text-slate-700">
                          ₹{Number(c.average_order_value).toFixed(2)}
                        </td>
                        <td className="p-4 text-slate-500">{c.last_order_date || 'No orders'}</td>
                        <td className="p-4 text-center">
                          {c.first500_consumed ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                              Used
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Unused</span>
                          )}
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
