'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Truck, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MapPin, 
  Navigation, 
  Barcode, 
  DollarSign, 
  Check, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  User, 
  Calendar, 
  Send,
  HelpCircle,
  Clock,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

interface DriverBag {
  id: string;
  bag_barcode: string;
  bag_sequence: number;
  total_bags: number;
  qr_token: string;
  is_driver_delivered: boolean;
  driver_scanned_at?: string;
}

interface DriverDelivery {
  delivery_id: string;
  delivery_sequence: number;
  delivery_status: 'pending' | 'out_for_delivery' | 'delivered' | 'failed' | 'rescheduled';
  cod_amount_expected: number;
  cod_amount_collected: number;
  payment_collection_method?: 'cash' | 'upi_delivery';
  failure_reason?: string;
  delivered_at?: string;
  order_id: string;
  order_number: string;
  delivery_date: string;
  customer_name_snapshot: string;
  customer_mobile_snapshot: string;
  customer_alternate_mobile_snapshot?: string;
  delivery_flat_house_snapshot: string;
  delivery_society_street_snapshot: string;
  delivery_landmark_snapshot: string;
  delivery_area_snapshot: string;
  delivery_city_snapshot: string;
  delivery_pincode_snapshot: string;
  delivery_latitude_snapshot?: number;
  delivery_longitude_snapshot?: number;
  special_instructions?: string;
  total_bags_count: number;
  bags: DriverBag[];
}

interface DriverBatch {
  id: string;
  batch_name: string;
  delivery_date: string;
  delivery_slot: string;
  status: 'draft' | 'assigned' | 'out_for_delivery' | 'completed';
  total_deliveries: number;
  completed_deliveries: number;
  started_at?: string;
}

interface DriverMetrics {
  total: number;
  delivered: number;
  pending: number;
  failed: number;
  cash_collected: number;
  upi_collected: number;
  total_collected: number;
}

export default function DriverMobileScreen() {
  const [driverId, setDriverId] = useState<string>('');
  const [driversList, setDriversList] = useState<{ id: string; full_name: string; mobile: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [batch, setBatch] = useState<DriverBatch | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [metrics, setMetrics] = useState<DriverMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Active delivery stop modal
  const [activeDelivery, setActiveDelivery] = useState<DriverDelivery | null>(null);
  const [scannedBagCode, setScannedBagCode] = useState<string>('');
  const [scanStatusMsg, setScanStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // COD Collection form state
  const [collectionMethod, setCollectionMethod] = useState<'cash' | 'upi_delivery'>('cash');
  const [collectedAmount, setCollectedAmount] = useState<string>('');
  const [mismatchReason, setMismatchReason] = useState<string>('');

  // Failure modal state
  const [showFailureModal, setShowFailureModal] = useState<boolean>(false);
  const [failureReason, setFailureReason] = useState<string>('customer_unavailable');
  const [failureNotes, setFailureNotes] = useState<string>('');

  // Cash settlement modal state
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [handedOverCash, setHandedOverCash] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');

  // Fetch initial drivers list
  useEffect(() => {
    async function loadDrivers() {
      try {
        const res = await fetch('/api/delivery/admin-summary');
        const json = await res.json();
        if (json.success && json.data?.drivers?.length > 0) {
          setDriversList(json.data.drivers);
          setDriverId(json.data.drivers[0].id);
        }
      } catch (err) {
        console.error('Error loading drivers:', err);
      }
    }
    loadDrivers();
  }, []);

  // Load Driver Summary & Deliveries
  const loadDriverDeliveries = useCallback(async () => {
    if (!driverId) return;
    setIsLoading(true);
    try {
      const url = new URL('/api/delivery/driver-summary', window.location.origin);
      url.searchParams.set('driver_id', driverId);
      if (selectedDate) url.searchParams.set('date', selectedDate);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success && json.data) {
        setBatch(json.data.batch);
        setDeliveries(json.data.deliveries || []);
        setMetrics(json.data.metrics);
        if (!selectedDate && json.data.delivery_date) {
          setSelectedDate(json.data.delivery_date);
        }

        // Update active stop if currently open
        if (activeDelivery) {
          const updated = (json.data.deliveries || []).find((d: DriverDelivery) => d.delivery_id === activeDelivery.delivery_id);
          if (updated) {
            setActiveDelivery(updated);
          }
        }
      }
    } catch (err) {
      console.error('Error loading driver deliveries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [driverId, selectedDate, activeDelivery]);

  useEffect(() => {
    loadDriverDeliveries();
  }, [loadDriverDeliveries]);

  // Open delivery modal
  const handleOpenStop = (del: DriverDelivery) => {
    setActiveDelivery(del);
    setScanStatusMsg(null);
    setCollectionMethod(del.payment_collection_method || 'cash');
    setCollectedAmount(String(del.cod_amount_expected));
    setMismatchReason('');
    setTimeout(() => scanInputRef.current?.focus(), 150);
  };

  // Start Delivery Run
  const handleStartRun = async () => {
    if (!batch) return;
    try {
      const res = await fetch('/api/delivery/batch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.id,
          driver_user_id: driverId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: '🚀 Delivery Run Started! All orders are now Out for Delivery.', type: 'success' });
        loadDriverDeliveries();
      } else {
        alert(json.error || 'Failed to start delivery batch');
      }
    } catch (err) {
      console.error(err);
      alert('Error starting delivery run');
    }
  };

  // Scan Bag Code at Doorstep
  const handleScanBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery || !scannedBagCode.trim()) return;

    const code = scannedBagCode.trim();
    setScannedBagCode('');

    try {
      const res = await fetch('/api/delivery/scan-bag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeDelivery.order_id,
          scanned_code: code,
          driver_user_id: driverId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setScanStatusMsg({
          text: `✅ ${json.message}`,
          type: 'success',
        });
        loadDriverDeliveries();
      } else if (json.error_code === 'WRONG_BAG_SCANNED') {
        setScanStatusMsg({
          text: `🚨 ${json.message}`,
          type: 'error',
        });
      } else if (json.error_code === 'BAG_ALREADY_SCANNED') {
        setScanStatusMsg({
          text: `ℹ️ ${json.message}`,
          type: 'info',
        });
      } else {
        setScanStatusMsg({
          text: `⚠️ ${json.message || json.error}`,
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Error scanning bag:', err);
      setScanStatusMsg({ text: 'Scan error', type: 'error' });
    }
  };

  // Complete Order Delivery
  const handleCompleteDelivery = async () => {
    if (!activeDelivery) return;

    const colAmt = Number(collectedAmount);
    if (isNaN(colAmt) || colAmt < 0) {
      alert('Please enter a valid collected amount');
      return;
    }

    if (colAmt !== activeDelivery.cod_amount_expected && !mismatchReason.trim()) {
      alert('Amount mismatch! Please enter a reason explaining why the collected amount differs from expected.');
      return;
    }

    try {
      const res = await fetch('/api/delivery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeDelivery.order_id,
          collection_method: collectionMethod,
          collected_amount: colAmt,
          mismatch_reason: mismatchReason.trim() || null,
          driver_user_id: driverId,
          idempotency_key: `del-${activeDelivery.order_id}-${Date.now()}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({
          text: `🎉 Order ${activeDelivery.order_number} marked DELIVERED! (Collected ₹${colAmt.toFixed(2)})`,
          type: 'success',
        });
        setActiveDelivery(null);
        loadDriverDeliveries();
      } else {
        alert(json.message || json.error || 'Failed to complete delivery');
      }
    } catch (err) {
      console.error('Error completing delivery:', err);
      alert('Error completing delivery');
    }
  };

  // Record Delivery Failure
  const handleReportFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;

    try {
      const res = await fetch('/api/delivery/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeDelivery.order_id,
          failure_reason: failureReason,
          notes: failureNotes,
          driver_user_id: driverId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowFailureModal(false);
        setFailureNotes('');
        setActionMessage({
          text: `⚠️ Order ${activeDelivery.order_number} marked as Could Not Deliver.`,
          type: 'warning',
        });
        setActiveDelivery(null);
        loadDriverDeliveries();
      } else {
        alert(json.message || json.error || 'Failed to record delivery failure');
      }
    } catch (err) {
      console.error('Error recording failure:', err);
    }
  };

  // Submit Driver Cash Settlement
  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;

    const handedAmt = Number(handedOverCash);
    if (isNaN(handedAmt) || handedAmt < 0) {
      alert('Please enter valid handed over cash amount');
      return;
    }

    try {
      const res = await fetch('/api/delivery/settlement/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_batch_id: batch.id,
          driver_user_id: driverId,
          handed_over_cash: handedAmt,
          notes: settlementNotes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowSettlementModal(false);
        setSettlementNotes('');
        setActionMessage({
          text: `✅ Cash settlement of ₹${handedAmt.toFixed(2)} submitted for verification!`,
          type: 'success',
        });
        loadDriverDeliveries();
      } else {
        alert(json.message || json.error || 'Failed to submit settlement');
      }
    } catch (err) {
      console.error('Error submitting settlement:', err);
    }
  };

  const allBagsScanned = activeDelivery ? activeDelivery.bags.length > 0 && activeDelivery.bags.every((b) => b.is_driver_delivered) : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 font-sans max-w-lg mx-auto pb-24">
      {/* Mobile Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center space-x-2.5">
          <span className="p-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
            <Truck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              <span>SABJIWALA DRIVER</span>
            </h1>
            <div className="text-[10px] text-slate-400 font-mono">Halol 10 AM–1 PM Dispatch</div>
          </div>
        </div>

        {/* Driver Selector */}
        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
          <User className="w-3.5 h-3.5 text-emerald-400" />
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="bg-transparent text-white font-bold focus:outline-none text-xs"
          >
            {driversList.map((d) => (
              <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                {d.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-3.5 rounded-2xl border text-xs mb-4 flex items-center justify-between gap-2 animate-fade-in ${
          actionMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200' :
          actionMessage.type === 'error' ? 'bg-red-950/70 border-red-500/50 text-red-200' :
          'bg-amber-950/70 border-amber-500/50 text-amber-200'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400">✕</button>
        </div>
      )}

      {/* Driver Dashboard KPI Grid */}
      {metrics && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total</div>
            <div className="text-xl font-black text-white font-mono">{metrics.total}</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-600/30 text-center">
            <div className="text-[10px] text-emerald-400 font-bold uppercase">Done</div>
            <div className="text-xl font-black text-emerald-300 font-mono">{metrics.delivered}</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-amber-950/30 border border-amber-600/30 text-center">
            <div className="text-[10px] text-amber-400 font-bold uppercase">Pending</div>
            <div className="text-xl font-black text-amber-300 font-mono">{metrics.pending}</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-red-950/30 border border-red-600/30 text-center">
            <div className="text-[10px] text-red-400 font-bold uppercase">Failed</div>
            <div className="text-xl font-black text-red-300 font-mono">{metrics.failed}</div>
          </div>
        </div>
      )}

      {/* Collection Total Card */}
      {metrics && (
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Today's Collection</div>
            <div className="text-lg font-black text-emerald-400 font-mono">
              ₹{Number(metrics.total_collected).toFixed(2)}
            </div>
          </div>
          <div className="text-right text-[11px] font-mono text-slate-400">
            <div>Cash: <strong className="text-white">₹{Number(metrics.cash_collected).toFixed(2)}</strong></div>
            <div>UPI: <strong className="text-white">₹{Number(metrics.upi_collected).toFixed(2)}</strong></div>
          </div>
        </div>
      )}

      {/* Start Run Banner if batch is assigned */}
      {batch && batch.status !== 'out_for_delivery' && batch.status !== 'completed' && (
        <div className="p-4 rounded-2xl bg-emerald-950 border border-emerald-600 text-center mb-4 space-y-2">
          <div className="text-xs font-bold text-emerald-200">
            Batch Assigned: <strong>{batch.batch_name}</strong> ({deliveries.length} orders)
          </div>
          <button
            onClick={handleStartRun}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/40 cursor-pointer"
          >
            Start Delivery Run 🚀
          </button>
        </div>
      )}

      {/* Deliveries List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase px-1">
          <span>Stops ({deliveries.length})</span>
          <button onClick={loadDriverDeliveries} className="flex items-center gap-1 text-slate-400 hover:text-white">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500 italic">
            No deliveries assigned for today yet.
          </div>
        ) : (
          deliveries.map((del) => (
            <div
              key={del.delivery_id}
              onClick={() => handleOpenStop(del)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-md ${
                del.delivery_status === 'delivered'
                  ? 'bg-emerald-950/20 border-emerald-800/40 opacity-75'
                  : del.delivery_status === 'failed'
                  ? 'bg-red-950/20 border-red-800/40'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 active:scale-[0.99]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-white text-xs font-mono font-bold flex items-center justify-center">
                    {del.delivery_sequence}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">{del.customer_name_snapshot}</h3>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      <span>{del.delivery_area_snapshot}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-emerald-400">
                    ₹{Number(del.cod_amount_expected).toFixed(0)}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono ${
                    del.delivery_status === 'delivered' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40' :
                    del.delivery_status === 'failed' ? 'bg-red-950 text-red-300 border border-red-600/40' :
                    del.delivery_status === 'out_for_delivery' ? 'bg-blue-950 text-blue-300 border border-blue-600/40' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {del.delivery_status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                <div className="flex items-center gap-1.5 font-mono">
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {del.bags.filter(b => b.is_driver_delivered).length}/{del.total_bags_count} Bags Scanned
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-[10px]">{del.order_number}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* End of Run / Cash Settlement Trigger */}
      {batch && metrics && metrics.delivered > 0 && (
        <div className="mt-8 pt-4 border-t border-slate-800 text-center">
          <button
            onClick={() => {
              setHandedOverCash(String(metrics.cash_collected));
              setShowSettlementModal(true);
            }}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg cursor-pointer"
          >
            Submit Cash Handover to Godown
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE DELIVERY STOP MODAL                                           */}
      {/* ========================================================================= */}
      {activeDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/90 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 my-auto animate-fade-in max-h-[92vh] overflow-y-auto">
            
            {/* Stop Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                  Stop #{activeDelivery.delivery_sequence} • {activeDelivery.order_number}
                </div>
                <h3 className="text-lg font-black text-white">{activeDelivery.customer_name_snapshot}</h3>
              </div>
              <button
                onClick={() => setActiveDelivery(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Dial & Map Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${activeDelivery.customer_mobile_snapshot}`}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Phone className="w-4 h-4" />
                <span>Call Customer</span>
              </a>

              <a
                href={
                  activeDelivery.delivery_latitude_snapshot && activeDelivery.delivery_longitude_snapshot
                    ? `https://www.google.com/maps/search/?api=1&query=${activeDelivery.delivery_latitude_snapshot},${activeDelivery.delivery_longitude_snapshot}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${activeDelivery.delivery_flat_house_snapshot}, ${activeDelivery.delivery_society_street_snapshot}, ${activeDelivery.delivery_area_snapshot}, Halol`
                      )}`
                }
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Navigation className="w-4 h-4" />
                <span>Open in Maps</span>
              </a>
            </div>

            {/* Alternate Phone if available */}
            {activeDelivery.customer_alternate_mobile_snapshot && (
              <div className="text-center">
                <a
                  href={`tel:${activeDelivery.customer_alternate_mobile_snapshot}`}
                  className="text-[11px] text-slate-400 underline font-mono"
                >
                  Alt: {activeDelivery.customer_alternate_mobile_snapshot} (Call Alternate)
                </a>
              </div>
            )}

            {/* Complete Address Snapshot Box */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{activeDelivery.delivery_flat_house_snapshot}, {activeDelivery.delivery_society_street_snapshot}</span>
              </div>
              <div className="text-slate-400 pl-4.5">Landmark: <strong className="text-slate-300">{activeDelivery.delivery_landmark_snapshot}</strong></div>
              <div className="text-slate-400 pl-4.5">Area: <strong className="text-slate-300">{activeDelivery.delivery_area_snapshot}, {activeDelivery.delivery_city_snapshot}</strong> ({activeDelivery.delivery_pincode_snapshot})</div>
              {activeDelivery.special_instructions && (
                <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-600/30 text-amber-200 text-[11px] mt-1">
                  Note: {activeDelivery.special_instructions}
                </div>
              )}
            </div>

            {/* STEP 1: DOORSTEP BAG SCANNER */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold uppercase text-white tracking-wider flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">1</span>
                  <span>Scan Bags ({activeDelivery.bags.filter(b => b.is_driver_delivered).length}/{activeDelivery.total_bags_count})</span>
                </span>
                <span className="text-[10px] text-slate-400">Scan before delivery</span>
              </div>

              {/* Barcode / Token Scanner Form */}
              <form onSubmit={handleScanBag} className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    ref={scanInputRef}
                    type="text"
                    placeholder="Scan bag barcode (SBJ-...-B01)..."
                    value={scannedBagCode}
                    onChange={(e) => setScannedBagCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Scan
                </button>
              </form>

              {scanStatusMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-bold ${
                  scanStatusMsg.type === 'success' ? 'bg-emerald-950 text-emerald-200 border border-emerald-600/40' :
                  scanStatusMsg.type === 'error' ? 'bg-red-950 text-red-200 border border-red-600/40 animate-shake' :
                  'bg-blue-950 text-blue-200'
                }`}>
                  {scanStatusMsg.text}
                </div>
              )}

              {/* Visual Bag Progress */}
              <div className="grid grid-cols-2 gap-2">
                {activeDelivery.bags.map((b) => (
                  <div
                    key={b.id}
                    className={`p-2 rounded-xl border text-xs font-mono font-bold flex items-center justify-between ${
                      b.is_driver_delivered
                        ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>BAG {b.bag_sequence}/{b.total_bags}</span>
                    {b.is_driver_delivered ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-amber-400">Scan ⏳</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 2: COD COLLECTION */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold uppercase text-white tracking-wider flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">2</span>
                  <span>COD Collection</span>
                </span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  COLLECT ₹{Number(activeDelivery.cod_amount_expected).toFixed(2)}
                </span>
              </div>

              {/* Payment Mode Selector */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCollectionMethod('cash')}
                  className={`py-2 rounded-xl font-bold transition-all cursor-pointer ${
                    collectionMethod === 'cash'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  💵 Cash at Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionMethod('upi_delivery')}
                  className={`py-2 rounded-xl font-bold transition-all cursor-pointer ${
                    collectionMethod === 'upi_delivery'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  📱 UPI at Delivery
                </button>
              </div>

              {/* Amount Entry & Mismatch */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                  <span className="text-slate-400 font-bold">Amount Received:</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-white font-bold">₹</span>
                    <input
                      type="number"
                      step="1"
                      value={collectedAmount}
                      onChange={(e) => setCollectedAmount(e.target.value)}
                      className="w-24 bg-transparent text-white font-mono font-black text-right text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {Number(collectedAmount) !== activeDelivery.cod_amount_expected && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-amber-400 font-bold">
                      ⚠️ Discrepancy: ₹{(Number(collectedAmount) - activeDelivery.cod_amount_expected).toFixed(2)} (Reason Required)
                    </div>
                    <input
                      type="text"
                      placeholder="Reason (e.g. customer short paid, change issue)..."
                      value={mismatchReason}
                      onChange={(e) => setMismatchReason(e.target.value)}
                      className="w-full p-2 rounded-xl bg-slate-900 border border-amber-600/50 text-white text-xs"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCompleteDelivery}
                disabled={!allBagsScanned || activeDelivery.delivery_status === 'delivered'}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {activeDelivery.delivery_status === 'delivered' ? 'Already Delivered' : 'Mark Delivered & Hand Over'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowFailureModal(true)}
                className="w-full py-2 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-700/40 rounded-xl text-xs font-bold cursor-pointer"
              >
                Could Not Deliver...
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELIVERY FAILURE REASON MODAL                                             */}
      {/* ========================================================================= */}
      {showFailureModal && activeDelivery && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3 text-xs">
            <h3 className="text-base font-bold text-red-400">Record Delivery Failure</h3>
            <form onSubmit={handleReportFailure} className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Failure Reason</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
                >
                  <option value="customer_unavailable">Customer Unavailable / Door Locked</option>
                  <option value="customer_unreachable">Phone Unreachable / Not Answering</option>
                  <option value="wrong_address">Wrong Address / Incomplete Landmark</option>
                  <option value="cash_unavailable">Cash Unavailable at Delivery</option>
                  <option value="customer_refused">Customer Refused Order</option>
                  <option value="quality_rejection">Quality Rejection at Doorstep</option>
                  <option value="missing_bag">Missing Bag in Vehicle</option>
                  <option value="other">Other Delivery Issue</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  placeholder="Notes for manager..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFailureModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold"
                >
                  Confirm Failed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASH SETTLEMENT SUBMISSION MODAL                                          */}
      {/* ========================================================================= */}
      {showSettlementModal && metrics && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3 text-xs">
            <h3 className="text-base font-bold text-white">Submit Physical Cash Handover</h3>
            <p className="text-slate-400 text-[11px]">
              Reconcile cash collected with Halol godown manager.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Deliveries:</span>
                <span className="font-bold text-white">{metrics.delivered}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">UPI Collected:</span>
                <span className="font-bold text-slate-300 font-mono">₹{metrics.upi_collected.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-emerald-400 font-bold">Physical Cash to Hand Over:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  ₹{metrics.cash_collected.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitSettlement} className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Actual Cash Handed Over (₹)</label>
                <input
                  type="number"
                  step="1"
                  value={handedOverCash}
                  onChange={(e) => setHandedOverCash(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-black text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Settlement Notes (optional)</label>
                <input
                  type="text"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="Notes for owner/manager..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                >
                  Submit Handover
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
