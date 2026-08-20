'use client';

import { getErrorMessage } from '@/lib/errors';






import { useState, useCallback, useEffect } from 'react';
import { Printer, ShoppingBag, Search, Download, RefreshCw, Phone, MapPin, AlertCircle, ExternalLink, ChevronRight, X } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { StatusChip } from '@/components/ui/StatusChip';
import { SlideOverDrawer } from '@/components/ui/SlideOverDrawer';
import ThermalBagSticker from '@/components/ThermalBagSticker';

type OrderTab = 'all' | 'new' | 'confirmed' | 'packing' | 'out_for_delivery' | 'delivered' | 'issues';

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderTab>('all');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printStickerOrder, setPrintStickerOrder] = useState<any | null>(null);

  // Map active tab to status filter
  const getStatusForTab = (tab: OrderTab) => {
    switch (tab) {
      case 'new': return 'draft';
      case 'confirmed': return 'confirmed';
      case 'packing': return 'packed'; // or packing
      case 'out_for_delivery': return 'out_for_delivery';
      case 'delivered': return 'delivered';
      case 'issues': return 'failed_delivery';
      default: return '';
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      
      const tabStatus = getStatusForTab(activeTab);
      if (tabStatus) params.set('status', tabStatus);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');

      const res = await fetch(`/api/reports/orders?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to load orders');
      }

      setOrders(json.data?.orders || []);
      setTotalCount(json.data?.total_count || 0);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error fetching orders');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, activeTab, search]);

  // Supabase Realtime Live Channel for instant order sync
  useEffect(() => {
    // Polling backup every 10s or instant on postgres changes
    const interval = setInterval(() => {
      fetchOrders();
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleDatePreset = (preset: 'today' | 'tomorrow' | 'this_week' | 'this_month' | '7days') => {
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
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const monday = new Date(now.setDate(diff));
      setStartDate(format(monday));
      setEndDate(format(new Date()));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(new Date()));
    } else if (preset === '7days') {
      const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setStartDate(format(past));
      setEndDate(format(new Date()));
    }
  };

  const handleRowClick = (order: any) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  const tabOptions: { key: OrderTab; label: string; labelGu?: string }[] = [
    { key: 'all', label: 'All Orders' },
    { key: 'confirmed', label: 'Confirmed', labelGu: 'કન્ફર્મ' },
    { key: 'packing', label: 'Packing', labelGu: 'પેકિંગ' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered', labelGu: 'ડિલિવર્ડ' },
    { key: 'issues', label: 'Issues', labelGu: 'સમસ્યા' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Orders (ઓર્ડર્સ)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono">
                {totalCount} Total
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live Realtime
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Showing live active order ledger for Halol deliveries
            </p>
          </div>

          {/* Quick Date Presets & Custom Dates & Export */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold gap-0.5">
              <button
                onClick={() => handleDatePreset('today')}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  startDate === endDate && startDate === new Date().toISOString().split('T')[0]
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handleDatePreset('tomorrow')}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  startDate === endDate && startDate !== new Date().toISOString().split('T')[0]
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tomorrow
              </button>
              <button
                onClick={() => handleDatePreset('this_week')}
                className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              >
                Week (અઠવાડિયું)
              </button>
              <button
                onClick={() => handleDatePreset('this_month')}
                className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              >
                Month (મહિનો)
              </button>
              <button
                onClick={() => handleDatePreset('7days')}
                className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              >
                7 Days
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-1 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                title="Start Date"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-2 py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                title="End Date"
              />
            </div>

            <a
              href={`/api/reports/export?type=orders&start_date=${startDate}&end_date=${endDate}`}
              download
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Download orders in Excel/CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </a>

            <button
              onClick={fetchOrders}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
              title="Refresh orders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xs space-y-3">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
            {tabOptions.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3.5 py-2 rounded-2xl whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{t.label}</span>
                  {t.labelGu && <span className="ml-1 opacity-80 font-normal">({t.labelGu})</span>}
                </button>
              );
            })}
          </div>

          {/* Search Field */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by order # (SBJ-...), customer name, mobile, or area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 5-COLUMN ORDER LIST / TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
          
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-2" />
              <span>Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-1">
              <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <div className="font-bold text-slate-700 dark:text-slate-300">No orders found</div>
              <div className="text-[11px] text-slate-500">
                Try selecting a different date range or clearing search filters.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((o) => {
                const totalAmount = Number(o.final_payable_amount || 0);

                return (
                  <div
                    key={o.id}
                    onClick={() => handleRowClick(o)}
                    className="p-4 sm:px-6 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    {/* Col 1 & 2: Order # and Customer */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      <div className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-100 dark:border-emerald-900/60 shrink-0">
                        {o.order_number}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {o.customer_name_snapshot || 'Guest Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{o.delivery_area_snapshot || 'Halol'}</span>
                          <span>&bull;</span>
                          <span className="font-mono">{o.customer_mobile_snapshot}</span>
                        </div>
                      </div>
                    </div>

                    {/* Col 3: Amount */}
                    <div className="sm:text-right shrink-0">
                      <div className="font-black text-slate-900 dark:text-white font-mono text-sm">
                        ₹{totalAmount.toFixed(0)} <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">{o.payment_method || 'COD'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {(o.items || []).length} items
                      </div>
                    </div>

                    {/* Col 4: Delivery */}
                    <div className="sm:text-right shrink-0 text-slate-600 dark:text-slate-400 text-[11px]">
                      <div className="font-bold text-slate-700 dark:text-slate-300">
                        {o.delivery_date}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        10:00 AM - 01:00 PM
                      </div>
                    </div>

                    {/* Col 5: Status + Arrow */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                      <StatusChip status={o.order_status} size="sm" />
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </main>

      {/* ORDER DETAIL SLIDE-OVER DRAWER */}
      <SlideOverDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedOrder ? `Order #${selectedOrder.order_number}` : 'Order Detail'}
        subtitle={selectedOrder?.created_at ? `Placed on ${new Date(selectedOrder.created_at).toLocaleDateString()}` : ''}
        footer={
          selectedOrder && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPrintStickerOrder(selectedOrder)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 shadow-2xs"
              >
                <Printer className="w-4 h-4 text-emerald-500" />
                <span>Thermal Sticker</span>
              </button>

              <a
                href={`/track/${selectedOrder.qr_access_token || selectedOrder.id}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <span>Live Customer Tracking</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6 text-xs">
            
            {/* Status & Key Amount Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Payable</span>
                <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 font-mono">
                  ₹{Number(selectedOrder.final_payable_amount || 0).toFixed(0)}
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {selectedOrder.payment_method === 'cod' ? 'Cash on Delivery (2% Disc Applied)' : 'Online Paid'}
                </span>
              </div>

              <StatusChip status={selectedOrder.order_status} size="md" />
            </div>

            {/* Customer Details */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Customer & Delivery Address
              </h4>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedOrder.customer_name_snapshot}
                  </div>
                  <a
                    href={`tel:${selectedOrder.customer_mobile_snapshot}`}
                    className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{selectedOrder.customer_mobile_snapshot}</span>
                  </a>
                </div>

                <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  {selectedOrder.delivery_flat_house_snapshot && `${selectedOrder.delivery_flat_house_snapshot}, `}
                  {selectedOrder.delivery_society_street_snapshot}, {selectedOrder.delivery_area_snapshot}, Halol - {selectedOrder.delivery_pincode_snapshot || '389350'}
                </div>
              </div>
            </div>

            {/* Ordered Items List */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Items Ordered (શાકભાજી સૂચિ)
              </h4>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                {(selectedOrder.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.name_gu || item.product_name_gu} <span className="font-normal text-slate-500">({item.name_en || item.product_name_en})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.variant_name_gu || item.variant_name_en || item.unit_code} &times; {item.quantity}
                      </div>
                    </div>

                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{Number(item.line_total || item.selling_price * item.quantity || 0).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-500">
                <span>Gross Merchandise:</span>
                <span>₹{Number(selectedOrder.gross_merchandise_amount || 0).toFixed(0)}</span>
              </div>
              {Number(selectedOrder.first500_discount_amount || 0) > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>FIRST500 (10% Disc):</span>
                  <span>-₹{Number(selectedOrder.first500_discount_amount).toFixed(0)}</span>
                </div>
              )}
              {Number(selectedOrder.cod_discount_amount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>COD 2% Cash Discount:</span>
                  <span>-₹{Number(selectedOrder.cod_discount_amount).toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Delivery:</span>
                <span className="text-emerald-600 font-bold">FREE</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                <span>Final Payable:</span>
                <span>₹{Number(selectedOrder.final_payable_amount || 0).toFixed(0)}</span>
              </div>
            </div>

          </div>
        )}
      </SlideOverDrawer>

      {/* Thermal Sticker Modal */}
      {printStickerOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Thermal Bag Sticker Preview
              </h3>
              <button
                onClick={() => setPrintStickerOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ThermalBagSticker
              payload={{
                header: 'SABJIWALA HALOL',
                order_id: printStickerOrder.id,
                order_number: printStickerOrder.order_number,
                bag_id: `bag-${printStickerOrder.id}-1`,
                bag_barcode: `SBJ-BAG-${printStickerOrder.order_number}-01`,
                bag_sequence: 1,
                total_bags: 1,
                customer_name: printStickerOrder.customer_name_snapshot,
                customer_mobile_masked: printStickerOrder.customer_mobile_snapshot || '',
                delivery_date: printStickerOrder.delivery_date,
                delivery_slot: '10:00 AM - 01:00 PM',
                delivery_area: printStickerOrder.delivery_area_snapshot,
                delivery_society_street: printStickerOrder.delivery_society_street_snapshot,
                payment_method: printStickerOrder.payment_method || 'COD',
                final_payable_amount: Number(printStickerOrder.final_payable_amount || 0),
                collect_cash_text: `₹${Number(printStickerOrder.final_payable_amount || 0).toFixed(0)} COD`,
                qr_token: printStickerOrder.qr_access_token || printStickerOrder.id,
                qr_url: `https://sabjiwala.in/b/${printStickerOrder.qr_access_token || printStickerOrder.id}`,
                printed_at: new Date().toISOString(),
                items_summary: (printStickerOrder.items || []).map((i: any) => ({
                  name_en: i.name_en || i.product_name_en || '',
                  name_gu: i.name_gu || i.product_name_gu || '',
                  variant_en: i.variant_name_en || '',
                  variant_gu: i.variant_name_gu || '',
                  qty: Number(i.quantity || 1),
                  unit: i.unit_code || 'kg',
                })),
              }}
            />

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sticker (50 &times; 50mm)</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
