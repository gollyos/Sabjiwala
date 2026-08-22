'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Truck, CheckCircle2, DollarSign, User, Plus, RefreshCw, X, Clock } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { StatCard } from '@/components/ui/StatCard';
import { StatusChip } from '@/components/ui/StatusChip';
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
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [metrics, setMetrics] = useState<AdminDeliveryMetrics | null>(null);
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [settlements, setSettlements] = useState<CashSettlement[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'batches' | 'settlements'>('batches');

  // Batch creation modal state
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [batchDriverId, setBatchDriverId] = useState<string>('');
  const batchSlot = '10:00 AM - 01:00 PM';
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string>('all');

  // Settlement verification modal state
  const [verifyingSettlement, setVerifyingSettlement] = useState<CashSettlement | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'verified' | 'disputed'>('verified');
  const [verifyNotes, setVerifyNotes] = useState<string>('');

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
          text: `Delivery Batch ${json.data.batch_name} created with ${json.data.total_assigned} orders!`,
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
          text: `Cash settlement verified successfully!`,
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

  const areasList = Array.from(new Set(eligibleOrders.map((o) => o.delivery_area_snapshot || 'Halol')));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        
        {/* Top Header */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Fleet &amp; Delivery Management (ડિલિવરી અને રોકડ મેનેજમેન્ટ)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Today&apos;s Deliveries &bull; <span className="font-normal text-slate-500">{selectedDate}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBatchModal(true)}
              disabled={eligibleOrders.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Route Batch ({eligibleOrders.length} Ready)</span>
            </button>

            <button
              onClick={loadDashboardData}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="p-4 rounded-2xl text-xs flex items-center gap-2 border bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Assigned Stops"
            value={metrics?.total_assigned || 0}
            icon={Truck}
            iconColor="text-blue-600"
            subValues={[
              { label: 'Out', value: metrics?.out_for_delivery || 0, color: 'text-amber-600' },
              { label: 'Delivered', value: metrics?.delivered || 0, color: 'text-emerald-600' },
            ]}
          />

          <StatCard
            title="Completed Rate"
            value={metrics?.total_assigned ? `${Math.round(((metrics.delivered) / metrics.total_assigned) * 100)}%` : '0%'}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            subValues={[
              { label: 'Successful', value: metrics?.delivered || 0 },
              { label: 'Failed', value: metrics?.failed || 0, color: metrics?.failed ? 'text-rose-600' : 'text-slate-400' },
            ]}
          />

          <StatCard
            title="COD Collected (રોકડ)"
            value={`₹${Number(metrics?.total_collected || 0).toLocaleString('en-IN')}`}
            icon={DollarSign}
            iconColor="text-teal-600"
            subValues={[
              { label: 'Cash', value: `₹${Number(metrics?.collected_cash || 0).toFixed(0)}` },
              { label: 'UPI', value: `₹${Number(metrics?.collected_upi || 0).toFixed(0)}`, color: 'text-teal-600' },
            ]}
          />

          <StatCard
            title="Pending COD Collection"
            value={`₹${Number(metrics?.pending_collection || 0).toLocaleString('en-IN')}`}
            icon={Clock}
            iconColor="text-amber-600"
            footerText={`Expected Total: ₹${Number(metrics?.expected_cod || 0).toFixed(0)}`}
          />
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1.5 rounded-2xl text-xs font-bold w-fit shadow-2xs">
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'batches'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Route Batches ({batches.length})
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'settlements'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Driver Cash Settlements ({settlements.length})
          </button>
        </div>

        {/* BATCHES TAB */}
        {activeTab === 'batches' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            {batches.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <div className="font-bold text-slate-700">No delivery batches created today</div>
                <div className="text-[11px] text-slate-500">Click &quot;Create Route Batch&quot; above to assign packed orders to a driver.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <div key={b.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm font-mono">{b.batch_name}</span>
                        <StatusChip status={b.status} size="sm" />
                      </div>
                      <div className="text-slate-500 mt-1 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        <span>Driver: <strong className="text-slate-800">{b.driver_name || 'Unassigned'}</strong></span>
                        {b.driver_mobile && <span className="font-mono">({b.driver_mobile})</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Progress</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {b.completed_deliveries} / {b.total_deliveries} Delivered
                        </span>
                      </div>

                      <a
                        href="/driver"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                      >
                        Open Driver View &rarr;
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTLEMENTS TAB */}
        {activeTab === 'settlements' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 text-xs font-bold text-slate-700">
              Driver End-of-Day Cash Handover Ledger
            </div>

            {settlements.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No cash settlements submitted for this date.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {settlements.map((s) => {
                  const hasDiff = Number(s.difference_amount || 0) !== 0;

                  return (
                    <div key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          Driver: {s.driver_name}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          Status: <span className="font-bold uppercase font-mono">{s.status}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block">Expected Cash</span>
                          <span className="font-bold text-slate-800">₹{Number(s.expected_cash_amount || 0).toFixed(0)}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block">Handed Over</span>
                          <span className="font-bold text-emerald-600">₹{Number(s.handed_over_cash_amount || 0).toFixed(0)}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block">Difference</span>
                          <span className={`font-black ${hasDiff ? 'text-rose-600' : 'text-slate-400'}`}>
                            {hasDiff ? `₹${Number(s.difference_amount).toFixed(0)}` : '₹0 (Exact)'}
                          </span>
                        </div>

                        {s.status !== 'verified' && (
                          <button
                            onClick={() => setVerifyingSettlement(s)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* CREATE ROUTE BATCH MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-xl w-full border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-slate-900 text-base">
                Create Delivery Route Batch
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Select Driver</label>
                <select
                  value={batchDriverId}
                  onChange={(e) => setBatchDriverId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:outline-none"
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
                <label className="block text-slate-500 font-bold mb-1">Filter by Halol Area</label>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="all">All Areas ({eligibleOrders.length} Orders)</option>
                  {areasList.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Order Selection List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center font-bold">
                  <span>Select Orders to Assign ({selectedOrderIds.length} Selected)</span>
                  <button type="button" onClick={handleSelectAllOrders} className="text-emerald-600 cursor-pointer">
                    Toggle All
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                  {eligibleOrders
                    .filter((o) => areaFilter === 'all' || o.delivery_area_snapshot === areaFilter)
                    .map((o) => (
                      <label
                        key={o.order_id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs cursor-pointer hover:border-emerald-300"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(o.order_id)}
                            onChange={() => handleToggleOrder(o.order_id)}
                            className="rounded text-emerald-600"
                          />
                          <span className="font-mono font-bold text-slate-900">{o.order_number}</span>
                          <span>&bull;</span>
                          <span className="text-slate-700">{o.customer_name_snapshot} ({o.delivery_area_snapshot})</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700">₹{Number(o.final_payable_amount).toFixed(0)}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  Create Batch ({selectedOrderIds.length} Orders)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERIFY SETTLEMENT MODAL */}
      {verifyingSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-md w-full border border-slate-200 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base">
              Verify Cash Handover &bull; {verifyingSettlement.driver_name}
            </h3>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-600">Expected COD Cash:</span>
                <span className="font-bold text-slate-900">₹{Number(verifyingSettlement.expected_cash_amount || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Handed Over:</span>
                <span>₹{Number(verifyingSettlement.handed_over_cash_amount || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between font-black text-rose-600 pt-1 border-t border-slate-200">
                <span>Difference:</span>
                <span>₹{Number(verifyingSettlement.difference_amount || 0).toFixed(0)}</span>
              </div>
            </div>

            <form onSubmit={handleVerifySettlement} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Status</label>
                <select
                  value={verifyStatus}
                  onChange={(e: any) => setVerifyStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="verified">Approve &amp; Deposit (Verified)</option>
                  <option value="disputed">Flag Discrepancy (Disputed)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Notes / Voucher</label>
                <input
                  type="text"
                  placeholder="e.g. Deposited in SBI Godown Account"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingSettlement(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  Save Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
