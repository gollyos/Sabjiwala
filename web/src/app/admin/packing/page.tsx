'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  QrCode, 
  Barcode, 
  RefreshCw, 
  Search, 
  Calendar, 
  Lock, 
  User, 
  MapPin, 
  Truck, 
  Scale, 
  Clock, 
  Layers, 
  ShieldAlert, 
  ChevronRight, 
  X, 
  Copy, 
  Check, 
  Plus, 
  Minus,
  AlertTriangle,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import ThermalBagSticker, { StickerPayload } from '@/components/ThermalBagSticker';

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

export default function WarehousePackingPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Active packing modal state
  const [activeOrder, setActiveOrder] = useState<QueueOrder | null>(null);
  const [staffName, setStaffName] = useState<string>('Packing Staff');
  const [scannedCode, setScannedCode] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Sticker print preview state
  const [printStickers, setPrintStickers] = useState<StickerPayload[]>([]);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [showReprintModal, setShowReprintModal] = useState<boolean>(false);
  const [reprintReason, setReprintReason] = useState<string>('Sticker Damaged');

  // Problem reporting modal
  const [showProblemModal, setShowProblemModal] = useState<boolean>(false);
  const [problemType, setProblemType] = useState<string>('item_unavailable');
  const [problemNotes, setProblemNotes] = useState<string>('');

  // Manager resolution modal
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [resolveNotes, setResolveNotes] = useState<string>('');

  // Load Queue & Stats
  const loadQueueData = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL('/api/packing/queue', window.location.origin);
      if (selectedDate) url.searchParams.set('date', selectedDate);
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);
      if (searchTerm) url.searchParams.set('search', searchTerm);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success && json.data) {
        setOrders(json.data.queue);
        setStats(json.data.stats);
        if (!selectedDate && json.data.target_date) {
          setSelectedDate(json.data.target_date);
        }

        // Update active order if open
        if (activeOrder) {
          const updated = json.data.queue.find((o: QueueOrder) => o.order_id === activeOrder.order_id);
          if (updated) setActiveOrder(updated);
        }
      }
    } catch (err) {
      console.error('Error loading packing queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, statusFilter, searchTerm, activeOrder]);

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
        setScanMessage(null);
        await loadQueueData();
        setTimeout(() => scanInputRef.current?.focus(), 150);
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
        // Update local state instantly
        setActiveOrder({
          ...activeOrder,
          items: activeOrder.items.map((it) =>
            it.id === item.id ? { ...it, is_confirmed: newConfirmed, packed_quantity: newQty } : it
          ),
          confirmed_items_count: activeOrder.confirmed_items_count + (newConfirmed ? 1 : -1),
        });
        loadQueueData();
      }
    } catch (err) {
      console.error('Error toggling item check:', err);
    }
  };

  // Update item actual packed weight
  const handleUpdateItemWeight = async (item: QueueItem, weight: number) => {
    if (!activeOrder) return;
    try {
      const res = await fetch('/api/packing/item-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item.id,
          packed_quantity: weight,
          is_confirmed: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActiveOrder({
          ...activeOrder,
          items: activeOrder.items.map((it) =>
            it.id === item.id ? { ...it, is_confirmed: true, packed_quantity: weight } : it
          ),
        });
      }
    } catch (err) {
      console.error('Error updating packed weight:', err);
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
        setActionMessage({ text: `Set bag count to ${count} for order ${activeOrder.order_number}.`, type: 'success' });
        loadQueueData();
      } else {
        alert(json.message || json.error || 'Failed to update bag count');
      }
    } catch (err) {
      console.error('Error updating bag count:', err);
    }
  };

  // Print Thermal Stickers
  const handlePrintStickers = async (bagId?: string, isReprint: boolean = false) => {
    if (!activeOrder) return;
    setIsPrinting(true);
    try {
      const res = await fetch('/api/packing/print-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
          bag_id: bagId || null,
          is_reprint: isReprint,
          reprint_reason: isReprint ? reprintReason : null,
          idempotency_key: `print-${activeOrder.order_id}-${Date.now()}`,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.stickers) {
        setPrintStickers(json.data.stickers);
        setShowReprintModal(false);

        // Open native browser print dialog after short DOM render tick
        setTimeout(() => {
          window.print();
        }, 300);

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

  // Verify Scanned Barcode / QR Code
  const handleVerifyScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !scannedCode.trim()) return;

    const code = scannedCode.trim();
    setScannedCode('');

    try {
      const res = await fetch('/api/packing/verify-bag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
          scanned_barcode_or_token: code,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setScanMessage({
          text: `✅ Bag ${json.verified_bag_sequence}/${json.total_bags} verified successfully!`,
          type: 'success',
        });
        loadQueueData();
      } else if (json.error_code === 'WRONG_BAG_SCANNED') {
        setScanMessage({
          text: `🚨 ${json.message}`,
          type: 'error',
        });
      } else if (json.error_code === 'BAG_ALREADY_VERIFIED') {
        setScanMessage({
          text: `ℹ️ ${json.message}`,
          type: 'info',
        });
      } else {
        setScanMessage({
          text: `⚠️ ${json.message || json.error}`,
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Error verifying barcode scan:', err);
      setScanMessage({ text: 'Error verifying barcode', type: 'error' });
    }
  };

  // Mark Order Ready for Delivery
  const handleMarkReady = async () => {
    if (!activeOrder) return;
    try {
      const res = await fetch('/api/packing/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: `🎉 Order ${activeOrder.order_number} marked READY FOR DELIVERY!`, type: 'success' });
        setActiveOrder(null);
        loadQueueData();
      } else {
        alert(json.message || json.error || 'Cannot mark ready: unverified items or bags remain.');
      }
    } catch (err) {
      console.error('Error marking order ready:', err);
      alert('Error completing packing');
    }
  };

  // Report Packing Problem
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
        setActionMessage({ text: `Order ${activeOrder.order_number} marked with PACKING PROBLEM.`, type: 'warning' });
        setActiveOrder(null);
        loadQueueData();
      } else {
        alert(json.message || json.error || 'Failed to report problem');
      }
    } catch (err) {
      console.error('Error reporting problem:', err);
    }
  };

  // Manager Resolve Problem
  const handleResolveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    try {
      const res = await fetch('/api/packing/resolve-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeOrder.order_id,
          resolution_notes: resolveNotes,
          resolved_status: 'packing',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowResolveModal(false);
        setResolveNotes('');
        setActionMessage({ text: `Problem resolved for ${activeOrder.order_number}. Order returned to packing.`, type: 'success' });
        loadQueueData();
      } else {
        alert(json.message || json.error || 'Failed to resolve problem');
      }
    } catch (err) {
      console.error('Error resolving problem:', err);
    }
  };

  const allItemsChecked = activeOrder ? activeOrder.items.every((it) => it.is_confirmed) : false;
  const allBagsVerified = activeOrder ? activeOrder.bags.length > 0 && activeOrder.bags.every((b) => b.is_verified) : false;
  const canMarkReady = allItemsChecked && allBagsVerified && activeOrder?.packing_status !== 'problem';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <Package className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Warehouse Packing & Sticker Dispatch</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700/50 font-mono">
                  10 AM–1 PM DISPATCH
                </span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Bag Allocation • Thermal Stickers • Barcode & QR Verification Gate
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/procurement"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            Procurement Report
          </Link>
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <User className="w-4 h-4 text-emerald-400" />
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="bg-transparent text-white font-bold w-28 focus:outline-none"
              placeholder="Staff Name"
              title="Packing Staff Name"
            />
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className={`max-w-7xl mx-auto mb-6 p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-3 animate-fade-in ${
          actionMessage.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' :
          actionMessage.type === 'error' ? 'bg-red-950/60 border-red-500/50 text-red-200' :
          'bg-amber-950/60 border-amber-500/50 text-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Live Metrics Header Bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Total Orders</div>
              <div className="text-2xl font-black text-white font-mono">{stats.orders.total}</div>
              <div className="text-[10px] text-slate-500 mt-1">Tomorrow Delivery</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Waiting to Pack</div>
              <div className="text-2xl font-black text-amber-400 font-mono">{stats.orders.waiting}</div>
              <div className="text-[10px] text-slate-500 mt-1">In Queue</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Packing Now</div>
              <div className="text-2xl font-black text-blue-400 font-mono">{stats.orders.packing}</div>
              <div className="text-[10px] text-slate-500 mt-1">In Progress</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Problems</div>
              <div className="text-2xl font-black text-red-400 font-mono">{stats.orders.problem}</div>
              <div className="text-[10px] text-slate-500 mt-1">Needs Manager</div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-600/30">
              <div className="text-xs text-emerald-400 mb-1 font-bold">Ready for Delivery</div>
              <div className="text-2xl font-black text-emerald-300 font-mono">{stats.orders.verified}</div>
              <div className="text-[10px] text-emerald-400 mt-1">Verified & Bagged</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Bags Verified</div>
              <div className="text-2xl font-black text-white font-mono">
                {stats.bags.verified} <span className="text-sm font-normal text-slate-500">/ {stats.bags.expected}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Printed: {stats.bags.printed}</div>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search order, customer, phone, bag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-white text-xs w-48 sm:w-64 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'waiting', label: 'Waiting' },
              { id: 'packing', label: 'Packing' },
              { id: 'verified', label: 'Ready' },
              { id: 'problem', label: 'Problems' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Packing Queue Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800 tracking-wider">
              <tr>
                <th className="p-4">Order Number</th>
                <th className="p-4">Customer & Area</th>
                <th className="p-4 text-center">Items Progress</th>
                <th className="p-4 text-center">Bags</th>
                <th className="p-4 text-right">Collect COD</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                    No orders found in packing queue for selected date/filter.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.order_id} className={`hover:bg-slate-800/40 transition-colors ${
                    ord.packing_status === 'problem' ? 'bg-red-950/20' : ''
                  }`}>
                    <td className="p-4 font-mono font-bold text-white">
                      <div>{ord.order_number}</div>
                      <div className="text-[10px] text-slate-500 font-sans font-normal">
                        {ord.payment_method.toUpperCase()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">{ord.customer_name_snapshot}</div>
                      <div className="text-slate-400 text-[11px]">{ord.delivery_area_snapshot}</div>
                      <div className="text-slate-500 text-[10px] font-mono">{ord.customer_mobile_snapshot}</div>
                    </td>
                    <td className="p-4 text-center font-mono">
                      <span className={`font-bold ${
                        ord.confirmed_items_count === ord.total_items_count ? 'text-emerald-400' : 'text-slate-300'
                      }`}>
                        {ord.confirmed_items_count} / {ord.total_items_count}
                      </span>
                      <div className="text-[10px] text-slate-500">items checked</div>
                    </td>
                    <td className="p-4 text-center font-mono">
                      <span className="font-bold text-white">{ord.total_bags_count} bag(s)</span>
                      <div className="text-[10px] text-slate-400">
                        {ord.bags.filter((b) => b.is_verified).length} verified
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      ₹{Number(ord.final_payable_amount).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${
                        ord.packing_status === 'verified' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40' :
                        ord.packing_status === 'packing' ? 'bg-blue-950 text-blue-300 border border-blue-600/40' :
                        ord.packing_status === 'problem' ? 'bg-red-950 text-red-300 border border-red-600/40' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {ord.packing_status}
                      </span>
                      {ord.packed_by_name && (
                        <div className="text-[10px] text-slate-500 mt-1">by {ord.packed_by_name}</div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenPacking(ord)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          ord.packing_status === 'verified'
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            : ord.packing_status === 'problem'
                            ? 'bg-red-700 hover:bg-red-600 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25'
                        }`}
                      >
                        {ord.packing_status === 'verified' ? 'View Bags' : ord.packing_status === 'problem' ? 'Resolve' : 'Pack Order'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* INTERACTIVE PACKING STATION MODAL */}
        {activeOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-fade-in">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-white text-base sm:text-lg font-mono">
                        {activeOrder.order_number}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                        activeOrder.packing_status === 'verified' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40' :
                        activeOrder.packing_status === 'problem' ? 'bg-red-950 text-red-300 border border-red-600/40' :
                        'bg-blue-950 text-blue-300'
                      }`}>
                        {activeOrder.packing_status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {activeOrder.customer_name_snapshot} • {activeOrder.delivery_area_snapshot} • {activeOrder.customer_mobile_snapshot}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowProblemModal(true)}
                    className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/50 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Report Problem
                  </button>
                  <button
                    onClick={() => setActiveOrder(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Concurrency Banner */}
              {activeOrder.packed_by_name && activeOrder.packed_by_name !== staffName && (
                <div className="p-3 bg-amber-950/80 border-b border-amber-600/40 text-amber-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>This order was opened by <strong>{activeOrder.packed_by_name}</strong>.</span>
                  </div>
                </div>
              )}

              {/* Modal Body */}
              <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
                
                {/* Step 1: Item Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-mono">1</span>
                      <span>Item Verification Checklist ({activeOrder.confirmed_items_count}/{activeOrder.total_items_count})</span>
                    </h4>
                    <span className="text-xs text-slate-400">Verify & record actual weights</span>
                  </div>

                  <div className="space-y-2">
                    {activeOrder.items.map((it) => (
                      <div
                        key={it.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          it.is_confirmed
                            ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-100'
                            : 'bg-slate-950/70 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => handleToggleItemCheck(it)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                              it.is_confirmed
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'border-slate-700 bg-slate-900 text-transparent hover:border-emerald-500'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <div>
                            <div className="font-bold text-sm text-white">
                              {it.name_gu} <span className="text-slate-400 text-xs">({it.name_en})</span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              Ordered: <strong className="text-white">{it.quantity} × {it.variant_gu || it.variant_en}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 self-end sm:self-center">
                          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1">
                            <span className="text-[11px] text-slate-400 font-bold">Packed:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={it.packed_quantity || it.quantity}
                              onChange={(e) => handleUpdateItemWeight(it, Number(e.target.value))}
                              className="w-16 bg-transparent text-white font-mono font-bold text-xs text-right focus:outline-none"
                            />
                            <span className="text-xs text-slate-400">{it.unit_code}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleItemCheck(it)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                              it.is_confirmed
                                ? 'bg-emerald-800/50 text-emerald-300 border border-emerald-600/40'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {it.is_confirmed ? 'Packed ✅' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2: Bag Allocation & Stickers */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-mono">2</span>
                      <span>Bag Count & Thermal Sticker Printing</span>
                    </h4>

                    {/* Bag Count Selector */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-bold">Number of Bags:</span>
                      {[1, 2, 3, 4].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => handleSetBagCount(cnt)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                            activeOrder.total_bags_count === cnt
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bags List & Print Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {activeOrder.bags.map((b) => (
                      <div key={b.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-white text-xs">{b.bag_barcode}</div>
                          <div className="text-[10px] text-slate-400">
                            Bag {b.bag_sequence} of {b.total_bags} • {b.is_verified ? 'Verified ✅' : 'Unverified ⏳'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePrintStickers(b.id)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
                          title="Print Sticker for this bag"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="text-xs text-slate-400">
                      COD Doorstep Collection: <strong className="text-emerald-400 font-mono text-sm">₹{Number(activeOrder.final_payable_amount).toFixed(2)}</strong>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowReprintModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
                      >
                        Reprint Reason...
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintStickers()}
                        disabled={isPrinting}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-emerald-600/30"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print All {activeOrder.total_bags_count} Bag Stickers</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 3: Barcode / QR Scanner Verification Gate */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-mono">3</span>
                      <span>Scan & Verify Bag Barcodes ({activeOrder.bags.filter(b => b.is_verified).length}/{activeOrder.total_bags_count})</span>
                    </h4>
                    <span className="text-xs text-slate-400">Prevents bag & order mismatch</span>
                  </div>

                  {/* Scan Input Form */}
                  <form onSubmit={handleVerifyScan} className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        ref={scanInputRef}
                        type="text"
                        placeholder="Scan or type bag barcode (e.g. SBJ-260817-10125-B01)..."
                        value={scannedCode}
                        onChange={(e) => setScannedCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Verify Bag
                    </button>
                  </form>

                  {scanMessage && (
                    <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      scanMessage.type === 'success' ? 'bg-emerald-950 text-emerald-200 border border-emerald-600/40' :
                      scanMessage.type === 'error' ? 'bg-red-950 text-red-200 border border-red-600/40 animate-shake' :
                      'bg-blue-950 text-blue-200'
                    }`}>
                      <span>{scanMessage.text}</span>
                    </div>
                  )}

                  {/* Bags Verified Indicator */}
                  <div className="flex flex-wrap gap-2">
                    {activeOrder.bags.map((b) => (
                      <div
                        key={b.id}
                        className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-2 ${
                          b.is_verified
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {b.is_verified ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                        <span>BAG {b.bag_sequence}/{b.total_bags}</span>
                        <span className="text-[10px] text-slate-400">({b.bag_barcode})</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Modal Footer Completion Action */}
              <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-400">
                  {canMarkReady ? (
                    <span className="text-emerald-400 font-bold">✅ 100% Items Checked & All Bags Verified</span>
                  ) : (
                    <span>⚠️ Must confirm all items and scan all bags before marking ready</span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setActiveOrder(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleMarkReady}
                    disabled={!canMarkReady}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs sm:text-sm cursor-pointer shadow-lg shadow-emerald-600/40"
                  >
                    Mark Ready for Delivery
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* REPRINT REASON MODAL */}
        {showReprintModal && activeOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white">Select Reprint Reason</h3>
              <p className="text-xs text-slate-400">
                Reprints are audited. Please state why the sticker needs to be reprinted.
              </p>
              <div className="space-y-2 text-xs">
                {['Sticker Damaged', 'Printer Jam', 'Unreadable Barcode', 'Bag Replaced', 'Other'].map((r) => (
                  <label key={r} className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="reprintReason"
                      value={r}
                      checked={reprintReason === r}
                      onChange={(e) => setReprintReason(e.target.value)}
                      className="text-emerald-600"
                    />
                    <span className="text-white font-semibold">{r}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReprintModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintStickers(undefined, true)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  Confirm & Reprint
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REPORT PROBLEM MODAL */}
        {showProblemModal && activeOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-red-400">Report Packing Problem</h3>
              <form onSubmit={handleReportProblem} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Problem Type</label>
                  <select
                    value={problemType}
                    onChange={(e) => setProblemType(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
                  >
                    <option value="item_unavailable">Item Unavailable</option>
                    <option value="insufficient_quantity">Insufficient Quantity</option>
                    <option value="damaged_stock">Damaged Stock / Poor Quality</option>
                    <option value="wrong_procurement_quantity">Wrong Procurement Quantity</option>
                    <option value="other">Other Warehouse Issue</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Problem Notes</label>
                  <textarea
                    rows={3}
                    value={problemNotes}
                    onChange={(e) => setProblemNotes(e.target.value)}
                    placeholder="Describe the issue for the owner/manager..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProblemModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold"
                  >
                    Flag Problem
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* HIDDEN PRINT CONTAINER FOR THERMAL LABELS */}
      <div id="thermal-print-area" className="hidden print:block">
        {printStickers.map((sticker) => (
          <ThermalBagSticker key={sticker.bag_id} payload={sticker} size="100x150" />
        ))}
      </div>
    </div>
  );
}
