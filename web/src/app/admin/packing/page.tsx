'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ThermalBagSticker, { StickerPayload } from '@/components/ThermalBagSticker';
import { CheckCircle2, Printer, RefreshCw, Search, MapPin, X, Check, Plus, Minus, AlertTriangle, Play } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { StatusChip } from '@/components/ui/StatusChip';
import { todayIST } from '@/lib/istDate';

interface QueueItem {
  id: string;
  product_id: string;
  name_en: string;
  name_gu: string;
  variant_en: string;
  variant_gu: string;
  quantity: number;
  packed_quantity: number | null;
  unit_code: string;
  is_confirmed: boolean;
  packing_notes?: string;
}

interface QueueBag {
  id: string;
  bag_barcode: string;
  bag_sequence: number;
  total_bags: number;
  is_verified: boolean;
  print_count: number;
  qr_token: string;
}

interface QueueOrder {
  order_id: string;
  order_number: string;
  delivery_date: string;
  delivery_slot_start: string;
  delivery_slot_end: string;
  order_status: string;
  packing_status: 'waiting' | 'packing' | 'packed' | 'verified' | 'problem';
  payment_method: string;
  final_payable_amount: number;
  customer_name_snapshot: string;
  customer_mobile_snapshot: string;
  delivery_area_snapshot: string;
  delivery_society_street_snapshot: string;
  delivery_flat_house_snapshot: string;
  special_instructions?: string;
  total_bags_count: number;
  packing_started_at?: string;
  packed_by_name?: string;
  packed_by_user_id?: string;
  packing_problem_type?: string;
  packing_problem_notes?: string;
  total_items_count: number;
  confirmed_items_count: number;
  bags: QueueBag[];
  items: QueueItem[];
}

interface DashboardStats {
  delivery_date: string;
  orders: {
    total: number;
    waiting: number;
    packing: number;
    packed: number;
    verified: number;
    problem: number;
  };
  bags: {
    expected: number;
    verified: number;
    printed: number;
    failed_prints: number;
  };
}

export default function GodownPackingStation() {
  const [selectedDate, setSelectedDate] = useState<string>(() => todayIST());
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'packing' | 'problem' | 'ready'>('waiting');
  // searchInput updates instantly as the admin types; searchTerm (debounced)
  // is what actually triggers the queue refetch, so typing doesn't fire a
  // network request + heavy DB query on every keystroke.
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);
  const staffName = 'Godown Worker 1';
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Active Packing Station State
  const [activeOrder, setActiveOrder] = useState<QueueOrder | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStickers, setPrintStickers] = useState<StickerPayload[] | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Problem Report Modal
  const [showProblemModal, setShowProblemModal] = useState<boolean>(false);
  const [problemType, setProblemType] = useState<string>('item_shortage');
  const [problemNotes, setProblemNotes] = useState<string>('');

  // Read the open order inside fetch callbacks without listing it in the
  // callback deps — otherwise every refresh creates a new activeOrder object,
  // re-triggers the effect, and refetches in an endless loop.
  const activeOrderRef = useRef<QueueOrder | null>(null);
  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  // Fetch Queue Data
  const loadQueueData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);

      const res = await fetch(`/api/packing/queue?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setStats(json.data.stats);
        setQueue(json.data.queue);
        if (json.data.target_date && !selectedDate) {
          setSelectedDate(json.data.target_date);
        }

        // Update active order if open
        const currentActive = activeOrderRef.current;
        if (currentActive) {
          const updated = json.data.queue.find((o: QueueOrder) => o.order_id === currentActive.order_id);
          if (updated) setActiveOrder(updated);
        }
      }
    } catch (err) {
      console.error('Error loading packing queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, statusFilter, searchTerm]);

  useEffect(() => {
    loadQueueData();
  }, [loadQueueData]);

  // Open Packing Station for an Order
  const handleOpenPacking = async (order: QueueOrder, forceOverride: boolean = false) => {
    try {
      const res = await fetch('/api/packing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.order_id,
          staff_name: staffName,
          force_override: forceOverride,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActiveOrder({
          ...order,
          packing_status: 'packing',
          packed_by_name: staffName,
        });
        await loadQueueData();
      } else if (json.error_code === 'ORDER_LOCKED_BY_OTHER') {
        if (confirm(`${json.message}\n\nDo you want to override and take over packing this order?`)) {
          handleOpenPacking(order, true);
        }
      } else {
        alert(json.message || json.error || 'Failed to start packing');
      }
    } catch (err) {
      console.error(err);
      alert('Error opening packing station');
    }
  };

  // Apply a partial update to one order everywhere it's held in state (the open
  // modal + its card in the background queue) without refetching the whole
  // queue+stats payload — that full reload was firing on every single item
  // tap/bag +/- click and was the main source of lag while packing an order.
  const patchOrder = useCallback((orderId: string, patch: Partial<QueueOrder>) => {
    setActiveOrder((prev) => (prev && prev.order_id === orderId ? { ...prev, ...patch } : prev));
    setQueue((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, ...patch } : o)));
  }, []);

  // Toggle item packed check
  const handleToggleItemCheck = async (item: QueueItem) => {
    if (!activeOrder) return;
    const newConfirmed = !item.is_confirmed;
    const newQty = item.packed_quantity || item.quantity;

    try {
      const res = await fetch('/api/packing/item-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item.id,
          packed_quantity: newQty,
          is_confirmed: newConfirmed,
        }),
      });

      const json = await res.json();
      if (json.success) {
        patchOrder(activeOrder.order_id, {
          items: activeOrder.items.map((it) =>
            it.id === item.id ? { ...it, is_confirmed: newConfirmed, packed_quantity: newQty } : it
          ),
          confirmed_items_count: activeOrder.confirmed_items_count + (newConfirmed ? 1 : -1),
        });
      }
    } catch (err) {
      console.error('Error toggling item check:', err);
    }
  };

  // Change Bag Count
  const handleSetBagCount = async (count: number) => {
    if (!activeOrder || count < 1 || count > 20) return;
    try {
      const res = await fetch('/api/packing/bags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
          bag_count: count,
          is_manager_override: activeOrder.packing_status === 'verified',
        }),
      });

      const json = await res.json();
      if (json.success) {
        patchOrder(activeOrder.order_id, { total_bags_count: count });
        setActionMessage({ text: `Set bag count to ${count} for order ${activeOrder.order_number}.`, type: 'success' });
      } else {
        alert(json.message || json.error || 'Failed to update bag count');
      }
    } catch (err) {
      console.error('Error updating bag count:', err);
    }
  };

  // Print Thermal Stickers
  const handlePrintStickers = async () => {
    if (!activeOrder) return;
    setIsPrinting(true);
    try {
      const res = await fetch('/api/packing/print-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
          is_reprint: false,
          idempotency_key: `print-${activeOrder.order_id}-${Date.now()}`,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.stickers) {
        setPrintStickers(json.data.stickers);
        setTimeout(() => window.print(), 300);
        loadQueueData();
      } else {
        alert(json.error || 'Failed to generate stickers');
      }
    } catch (err) {
      console.error('Error printing stickers:', err);
      alert('Failed to print stickers');
    } finally {
      setIsPrinting(false);
    }
  };

  // 1-Click Quick Pack & Complete Order (No physical barcode scanning required)
  const handleQuickPackAndReady = async () => {
    if (!activeOrder) return;
    try {
      // 1. Confirm all unconfirmed items — fired in parallel, not one-by-one,
      // since awaiting each item sequentially added a full round-trip of lag
      // per item on orders with many line items.
      const unconfirmed = activeOrder.items.filter((item) => !item.is_confirmed);
      await Promise.all(
        unconfirmed.map((item) =>
          fetch('/api/packing/item-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_item_id: item.id,
              packed_quantity: item.quantity,
              is_confirmed: true,
            }),
          })
        )
      );

      // 2. Mark ready for delivery
      const res = await fetch('/api/packing/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: `✅ Order ${activeOrder.order_number} successfully packed & marked ready for delivery!`, type: 'success' });
        setActiveOrder(null);
        loadQueueData();
      } else {
        alert(json.message || json.error || 'Failed to complete packing');
      }
    } catch (err) {
      console.error('Quick pack error:', err);
      alert('Error completing quick pack');
    }
  };

  // Submit Problem Report
  const handleReportProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;

    try {
      const res = await fetch('/api/packing/problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
          problem_type: problemType,
          notes: problemNotes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowProblemModal(false);
        setProblemNotes('');
        setActiveOrder(null);
        setActionMessage({ text: `Reported problem on ${activeOrder.order_number}. Moved to Problem Queue.`, type: 'success' });
        loadQueueData();
      } else {
        alert(json.error || 'Failed to record problem');
      }
    } catch (err) {
      console.error('Error recording problem:', err);
    }
  };

  const totalOrders = stats?.orders?.total || 0;
  const completedOrders = (stats?.orders?.packed || 0) + (stats?.orders?.verified || 0);
  const progressPercent = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        
        {/* Top Header: Operational Station & Progress */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Godown Packing Station (પેકિંગ સ્ટેશન)
                </span>
                <span className="text-xs text-slate-400">&bull;</span>
                <span className="text-xs font-mono font-bold text-slate-600">
                  Staff: {staffName}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                Packing &bull; <span className="text-emerald-700">{completedOrders} of {totalOrders} Completed</span> ({progressPercent}%)
              </h1>
            </div>

            <button
              onClick={loadQueueData}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer self-start sm:self-auto shadow-2xs"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            </button>
          </div>

          {/* Large Clean Progress Bar */}
          <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {actionMessage && (
          <div className={`p-4 rounded-2xl text-xs flex items-center gap-2 border font-semibold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* 4 Tabs: Waiting, Packing, Problems, Ready */}
        <div className="bg-white border border-slate-200 p-3 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold scrollbar-none">
            <button
              onClick={() => setStatusFilter('waiting')}
              className={`px-4 py-2 rounded-2xl transition-all cursor-pointer ${
                statusFilter === 'waiting'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Waiting ({stats?.orders?.waiting || 0})
            </button>
            <button
              onClick={() => setStatusFilter('packing')}
              className={`px-4 py-2 rounded-2xl transition-all cursor-pointer ${
                statusFilter === 'packing'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Packing ({stats?.orders?.packing || 0})
            </button>
            <button
              onClick={() => setStatusFilter('problem')}
              className={`px-4 py-2 rounded-2xl transition-all cursor-pointer ${
                statusFilter === 'problem'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Problems ({stats?.orders?.problem || 0})
            </button>
            <button
              onClick={() => setStatusFilter('ready')}
              className={`px-4 py-2 rounded-2xl transition-all cursor-pointer ${
                statusFilter === 'ready'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ready ({stats?.orders?.packed || 0})
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Filter order # or customer..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* ORDER CARDS QUEUE GRID */}
        {queue.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-xs text-slate-400 space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <div className="font-bold text-slate-700">
              {statusFilter === 'waiting' ? 'No orders waiting to be packed 🎉' : 'No orders in this queue'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {queue.map((order) => {
              const isProblem = order.packing_status === 'problem';
              const isReady = order.packing_status === 'packed' || order.packing_status === 'verified';

              return (
                <div
                  key={order.order_id}
                  className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                    isProblem
                      ? 'border-rose-200 bg-rose-50/20'
                      : isReady
                      ? 'border-teal-200 bg-teal-50/10'
                      : 'border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-emerald-700 text-sm bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        {order.order_number}
                      </span>
                      <StatusChip status={order.packing_status} size="sm" />
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 text-base">
                        {order.customer_name_snapshot}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{order.delivery_area_snapshot}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 text-xs font-bold text-slate-600 font-mono">
                      <span>{order.total_items_count} Items</span>
                      <span>&bull;</span>
                      <span>{order.total_bags_count} Bags</span>
                      <span>&bull;</span>
                      <span className="text-emerald-700">{order.confirmed_items_count}/{order.total_items_count} Checked</span>
                    </div>

                    {order.special_instructions && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                        <strong>Note:</strong> {order.special_instructions}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPacking(order)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{order.packing_status === 'packing' ? 'Resume Packing' : 'Start Packing'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* ACTIVE PACKING STATION MODAL (Touchscreen-optimized) */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-emerald-700 text-lg">
                    {activeOrder.order_number}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="font-bold text-slate-900 text-base">
                    {activeOrder.customer_name_snapshot}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {activeOrder.delivery_area_snapshot} &bull; Bag count: {activeOrder.total_bags_count}
                </div>
              </div>

              <button
                onClick={() => setActiveOrder(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Checklist Content */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                <span>Vegetable Items Checklist (શાકભાજી ચેકલિસ્ટ)</span>
                <span className="text-emerald-700 font-mono">
                  {activeOrder.confirmed_items_count} of {activeOrder.total_items_count} Packed
                </span>
              </div>

              {/* Items List with Large [ Packed ✓ ] Buttons */}
              <div className="space-y-2.5">
                {activeOrder.items.map((item) => {
                  const isChecked = item.is_confirmed;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-emerald-50/80 border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 text-base">
                          {item.name_gu} <span className="font-normal text-slate-500 text-xs">({item.name_en})</span>
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                          {item.variant_gu || item.variant_en} &times; {item.quantity} {item.unit_code}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleItemCheck(item)}
                        className={`px-5 py-3 rounded-2xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs ${
                          isChecked
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>{isChecked ? 'Packed ✓' : 'Mark Pack'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Bag Count Adjustment */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Total Bags Used:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSetBagCount(activeOrder.total_bags_count - 1)}
                    disabled={activeOrder.total_bags_count <= 1}
                    className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-black text-sm px-2 text-slate-900">{activeOrder.total_bags_count}</span>
                  <button
                    onClick={() => handleSetBagCount(activeOrder.total_bags_count + 1)}
                    className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Action Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowProblemModal(true)}
                className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-100"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Report Problem</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintStickers}
                  disabled={isPrinting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-slate-50"
                  title="Print stickers or normal invoice slip"
                >
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span>Print Slip / Stickers</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickPackAndReady}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                  title="Mark all items confirmed & complete packing in 1 click"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>1-Click Complete &amp; Ready (પેકિંગ પૂર્ણ ✓)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Problem Report Modal */}
      {showProblemModal && activeOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-md w-full border border-slate-200 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>Report Packing Issue &bull; #{activeOrder.order_number}</span>
            </h3>

            <form onSubmit={handleReportProblem} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Issue Type</label>
                <select
                  value={problemType}
                  onChange={(e) => setProblemType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="item_shortage">Item Shortage / Out of Stock</option>
                  <option value="damaged_vegetable">Damaged Quality Vegetable</option>
                  <option value="customer_special_req">Special Request Clarification</option>
                  <option value="weight_variance">Significant Weight Variance</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Describe the issue for the owner..."
                  value={problemNotes}
                  onChange={(e) => setProblemNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProblemModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  Flag Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Thermal Stickers Render Container for Print */}
      {printStickers && (
        <div className="hidden print:block fixed inset-0 bg-white z-50 p-0 m-0">
          {printStickers.map((sticker, idx) => (
            <div key={idx} className="page-break-after p-2">
              <ThermalBagSticker payload={sticker} />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
