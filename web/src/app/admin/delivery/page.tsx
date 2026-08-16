'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Calendar, 
  User, 
  Plus, 
  Search, 
  RefreshCw, 
  MapPin, 
  Check, 
  X, 
  AlertTriangle, 
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';

interface DriverOption {
  id: string;
  full_name: string;
  mobile: string;
}

interface EligibleOrder {
  order_id: string;
  order_number: string;
  delivery_area_snapshot: string;
  customer_name_snapshot: string;
  final_payable_amount: number;
  total_bags_count: number;
}

interface AdminBatch {
  id: string;
  batch_name: string;
  delivery_date: string;
  delivery_slot: string;
  status: 'draft' | 'assigned' | 'out_for_delivery' | 'completed';
  total_deliveries: number;
  completed_deliveries: number;
  driver_name?: string;
  driver_mobile?: string;
  started_at?: string;
  completed_at?: string;
}

interface CashSettlement {
  id: string;
  delivery_batch_id: string;
  delivery_date: string;
  expected_cash_amount: number;
  collected_cash_amount: number;
  collected_upi_delivery_amount: number;
  handed_over_cash_amount: number;
  difference_amount: number;
  status: 'pending' | 'submitted' | 'verified' | 'disputed';
  driver_name?: string;
  verified_by_name?: string;
  handed_over_at?: string;
  notes?: string;
}

interface AdminDeliveryMetrics {
  total_assigned: number;
  out_for_delivery: number;
  delivered: number;
  failed: number;
  pending: number;
  expected_cod: number;
  collected_cash: number;
  collected_upi: number;
  total_collected: number;
  pending_collection: number;
}

export default function AdminDeliveryPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [metrics, setMetrics] = useState<AdminDeliveryMetrics | null>(null);
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [settlements, setSettlements] = useState<CashSettlement[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Batch creation modal state
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [batchDriverId, setBatchDriverId] = useState<string>('');
  const [batchSlot, setBatchSlot] = useState<string>('10:00 AM - 01:00 PM');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string>('all');

  // Settlement verification modal state
  const [verifyingSettlement, setVerifyingSettlement] = useState<CashSettlement | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'verified' | 'disputed'>('verified');
  const [verifyNotes, setVerifyNotes] = useState<string>('');

  // Reschedule modal state
  const [reschedulingOrder, setReschedulingOrder] = useState<{ id: string; order_number: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('Customer was unavailable');

  // Load Dashboard Data
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL('/api/delivery/admin-summary', window.location.origin);
      if (selectedDate) url.searchParams.set('date', selectedDate);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success && json.data) {
        setMetrics(json.data.metrics);
        setBatches(json.data.batches || []);
        setSettlements(json.data.settlements || []);
        setEligibleOrders(json.data.eligible_unassigned_orders || []);
        setDrivers(json.data.drivers || []);
        if (!selectedDate && json.data.delivery_date) {
          setSelectedDate(json.data.delivery_date);
        }
        if (!batchDriverId && json.data.drivers?.length > 0) {
          setBatchDriverId(json.data.drivers[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading admin delivery data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, batchDriverId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Order Selection in Batch Creator
  const handleToggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAllOrders = () => {
    const filteredOrders = areaFilter === 'all'
      ? eligibleOrders
      : eligibleOrders.filter((o) => o.delivery_area_snapshot === areaFilter);

    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.order_id));
    }
  };

  // Create Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      alert('Please select at least one order.');
      return;
    }

    try {
      const res = await fetch('/api/delivery/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_date: selectedDate,
          delivery_slot: batchSlot,
          driver_user_id: batchDriverId,
          order_ids: selectedOrderIds,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowBatchModal(false);
        setSelectedOrderIds([]);
        setActionMessage({
          text: `🎉 Delivery Batch ${json.data.batch_name} created with ${json.data.total_assigned} orders!`,
          type: 'success',
        });
        loadDashboardData();
      } else {
        alert(json.message || json.error || 'Failed to create delivery batch');
      }
    } catch (err) {
      console.error('Error creating delivery batch:', err);
    }
  };

  // Verify Settlement
  const handleVerifySettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingSettlement) return;

    try {
      const res = await fetch('/api/delivery/settlement/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlement_id: verifyingSettlement.id,
          status: verifyStatus,
          notes: verifyNotes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setVerifyingSettlement(null);
        setVerifyNotes('');
        setActionMessage({
          text: `✅ Cash settlement verified successfully!`,
          type: 'success',
        });
        loadDashboardData();
      } else {
        alert(json.message || json.error || 'Failed to verify settlement');
      }
    } catch (err) {
      console.error('Error verifying settlement:', err);
    }
  };

  // Reschedule Order
  const handleRescheduleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingOrder || !rescheduleDate) return;

    try {
      const res = await fetch('/api/delivery/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: reschedulingOrder.id,
          new_delivery_date: rescheduleDate,
          reason: rescheduleReason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setReschedulingOrder(null);
        setActionMessage({
          text: `Order ${reschedulingOrder.order_number} rescheduled to ${rescheduleDate}.`,
          type: 'success',
        });
        loadDashboardData();
      } else {
        alert(json.message || json.error || 'Failed to reschedule order');
      }
    } catch (err) {
      console.error('Error rescheduling order:', err);
    }
  };

  const areas = Array.from(new Set(eligibleOrders.map((o) => o.delivery_area_snapshot)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <Truck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Delivery Management & Cash Settlement</span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Batch Allocation • Multi-Stop Delivery • Driver Handover Reconciliations
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/packing"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            Packing Station
          </Link>
          <Link
            href="/driver"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md"
          >
            Open Driver App 📱
          </Link>
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-bold font-mono focus:outline-none"
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
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Live Delivery Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-bold uppercase">Assigned</div>
              <div className="text-2xl font-black text-white font-mono">{metrics.total_assigned}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-600/30">
              <div className="text-[11px] text-blue-400 font-bold uppercase">Out for Del</div>
              <div className="text-2xl font-black text-blue-300 font-mono">{metrics.out_for_delivery}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-600/30">
              <div className="text-[11px] text-emerald-400 font-bold uppercase">Delivered</div>
              <div className="text-2xl font-black text-emerald-300 font-mono">{metrics.delivered}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-600/30">
              <div className="text-[11px] text-red-400 font-bold uppercase">Failed</div>
              <div className="text-2xl font-black text-red-300 font-mono">{metrics.failed}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-bold uppercase">Expected COD</div>
              <div className="text-xl font-black text-white font-mono">₹{Number(metrics.expected_cod).toFixed(0)}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-emerald-400 font-bold uppercase">Cash Collected</div>
              <div className="text-xl font-black text-emerald-400 font-mono">₹{Number(metrics.collected_cash).toFixed(0)}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-cyan-400 font-bold uppercase">UPI at Del</div>
              <div className="text-xl font-black text-cyan-400 font-mono">₹{Number(metrics.collected_upi).toFixed(0)}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-600/30">
              <div className="text-[11px] text-amber-400 font-bold uppercase">Pending COD</div>
              <div className="text-xl font-black text-amber-300 font-mono">₹{Number(metrics.pending_collection).toFixed(0)}</div>
            </div>
          </div>
        )}

        {/* Action Header: Create Delivery Batch */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center space-x-3">
            <span className="font-extrabold text-sm text-white uppercase tracking-wider">
              Delivery Batches ({batches.length})
            </span>
            <span className="text-xs text-slate-400">
              {eligibleOrders.length} eligible packed order(s) waiting for assignment
            </span>
          </div>

          <button
            onClick={() => setShowBatchModal(true)}
            disabled={eligibleOrders.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Delivery Batch</span>
          </button>
        </div>

        {/* Active Batches Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800 tracking-wider">
              <tr>
                <th className="p-4">Batch Name</th>
                <th className="p-4">Assigned Driver</th>
                <th className="p-4">Slot</th>
                <th className="p-4 text-center">Progress</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                    No delivery batches created for {selectedDate}. Click "Create Delivery Batch" to assign packed orders.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-white">{b.batch_name}</td>
                    <td className="p-4">
                      <div className="font-bold text-white">{b.driver_name || 'Unassigned'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{b.driver_mobile}</div>
                    </td>
                    <td className="p-4 text-slate-400">{b.delivery_slot}</td>
                    <td className="p-4 text-center font-mono">
                      <span className="font-bold text-emerald-400">{b.completed_deliveries}</span> / {b.total_deliveries}
                      <div className="text-[10px] text-slate-500">completed</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${
                        b.status === 'completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40' :
                        b.status === 'out_for_delivery' ? 'bg-blue-950 text-blue-300 border border-blue-600/40' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href="/driver"
                        target="_blank"
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                      >
                        View Driver View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CASH SETTLEMENT RECONCILIATION SECTION */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Godown Driver Cash Settlements</span>
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Verify physical cash handed over by drivers after completing morning delivery runs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-800 tracking-wider">
                <tr>
                  <th className="p-3">Driver</th>
                  <th className="p-3 text-right">Expected Cash</th>
                  <th className="p-3 text-right">Handed Over</th>
                  <th className="p-3 text-right">Difference</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                      No cash settlements submitted for this date yet.
                    </td>
                  </tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-white">{s.driver_name}</td>
                      <td className="p-3 text-right font-mono font-bold">₹{Number(s.collected_cash_amount).toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        ₹{Number(s.handed_over_cash_amount).toFixed(2)}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${
                        Number(s.difference_amount) === 0 ? 'text-slate-400' : 'text-red-400'
                      }`}>
                        ₹{Number(s.difference_amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                          s.status === 'verified' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40' :
                          s.status === 'disputed' ? 'bg-red-950 text-red-300 border border-red-600/40' :
                          'bg-amber-950 text-amber-300 border border-amber-600/40'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {s.status === 'submitted' ? (
                          <button
                            onClick={() => setVerifyingSettlement(s)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                          >
                            Verify
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">Verified by {s.verified_by_name || 'Owner'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* CREATE BATCH MODAL                                                        */}
      {/* ========================================================================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span>Create Delivery Batch ({selectedDate})</span>
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Assign Driver</label>
                  <select
                    value={batchDriverId}
                    onChange={(e) => setBatchDriverId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    required
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.mobile})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Delivery Slot</label>
                  <input
                    type="text"
                    value={batchSlot}
                    onChange={(e) => setBatchSlot(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  />
                </div>
              </div>

              {/* Area Filter & Select All */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 font-bold">Filter Area:</span>
                  <select
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    <option value="all">All Areas ({eligibleOrders.length})</option>
                    {areas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSelectAllOrders}
                  className="text-emerald-400 font-bold underline cursor-pointer"
                >
                  Select / Deselect All
                </button>
              </div>

              {/* Eligible Orders Checklist */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {eligibleOrders
                  .filter((o) => areaFilter === 'all' || o.delivery_area_snapshot === areaFilter)
                  .map((ord) => {
                    const isSelected = selectedOrderIds.includes(ord.order_id);
                    return (
                      <div
                        key={ord.order_id}
                        onClick={() => handleToggleOrder(ord.order_id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-600/50 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                            isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="font-bold text-white">{ord.customer_name_snapshot} ({ord.order_number})</div>
                            <div className="text-[11px] text-slate-400">{ord.delivery_area_snapshot} • {ord.total_bags_count} bag(s)</div>
                          </div>
                        </div>

                        <div className="font-mono font-bold text-emerald-400">
                          ₹{Number(ord.final_payable_amount).toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  Selected: <strong className="text-white">{selectedOrderIds.length}</strong> orders
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedOrderIds.length === 0}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold cursor-pointer"
                  >
                    Assign Batch
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VERIFY CASH SETTLEMENT MODAL                                              */}
      {/* ========================================================================= */}
      {verifyingSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-white">Verify Driver Cash Settlement</h3>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Driver:</span>
                <span className="font-bold text-white">{verifyingSettlement.driver_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expected Cash:</span>
                <span className="font-bold text-white">₹{verifyingSettlement.collected_cash_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Handed Over:</span>
                <span className="font-bold text-emerald-400">₹{verifyingSettlement.handed_over_cash_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">Difference:</span>
                <span className={`font-bold ${verifyingSettlement.difference_amount === 0 ? 'text-slate-400' : 'text-red-400'}`}>
                  ₹{verifyingSettlement.difference_amount.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleVerifySettlement} className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Verification Status</label>
                <select
                  value={verifyStatus}
                  onChange={(e) => setVerifyStatus(e.target.value as 'verified' | 'disputed')}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                >
                  <option value="verified">Verified (Cash Reconciled)</option>
                  <option value="disputed">Disputed (Cash Discrepancy)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Verification Notes</label>
                <input
                  type="text"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Verification notes or discrepancy remarks..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingSettlement(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Confirm Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
