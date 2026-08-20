'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Truck, 
  CheckCircle2, 
  Phone, 
  MapPin, 
  Navigation, 
  Check, 
  X, 
  RefreshCw, 
  Lock,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { StatusChip } from '@/components/ui/StatusChip';

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
  delivery_flat_house_snapshot: string;
  delivery_society_street_snapshot: string;
  delivery_landmark_snapshot: string;
  delivery_area_snapshot: string;
  delivery_city_snapshot: string;
  delivery_pincode_snapshot: string;
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
  const [supabase] = useState(() => createClient());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isManagerOrOwner, setIsManagerOrOwner] = useState(false);

  const [driverId, setDriverId] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driversList, setDriversList] = useState<{ id: string; full_name: string; mobile: string }[]>([]);
  const [selectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
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
  const [completingDelivery, setCompletingDelivery] = useState(false);

  // Failure modal state
  const [showFailureModal, setShowFailureModal] = useState<boolean>(false);
  const [failureReason, setFailureReason] = useState<string>('customer_unavailable');
  const [failureNotes, setFailureNotes] = useState<string>('');

  // 1. Authenticate Driver Session
  useEffect(() => {
    async function checkAuth() {
      try {
        setCheckingAuth(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setIsAuthorized(false);
          return;
        }

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);

        const roles = (roleData || []).map(r => r.role);
        const hasAccess = roles.includes('delivery') || roles.includes('manager') || roles.includes('owner');

        if (!hasAccess) {
          setIsAuthorized(false);
          return;
        }

        setIsAuthorized(true);
        const managerOrOwner = roles.includes('owner') || roles.includes('manager');
        setIsManagerOrOwner(managerOrOwner);

        setDriverId(session.user.id);

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle();

        setDriverName(profile?.full_name || 'Delivery Partner');

        // If manager or owner, allow viewing other drivers
        if (managerOrOwner) {
          const res = await fetch('/api/delivery/admin-summary');
          const json = await res.json();
          if (json.success && json.data?.drivers?.length > 0) {
            setDriversList(json.data.drivers);
          }
        }
      } catch (err) {
        console.error('Driver auth check error:', err);
        setIsAuthorized(false);
      } finally {
        setCheckingAuth(false);
      }
    }

    checkAuth();
  }, [supabase]);

  // Load Driver Deliveries
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

        if (activeDelivery) {
          const updated = (json.data.deliveries || []).find((d: DriverDelivery) => d.delivery_id === activeDelivery.delivery_id);
          if (updated) setActiveDelivery(updated);
        }
      }
    } catch (err) {
      console.error('Error loading driver deliveries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [driverId, selectedDate, activeDelivery]);

  useEffect(() => {
    if (isAuthorized && driverId) {
      loadDriverDeliveries();
    }
  }, [isAuthorized, driverId, loadDriverDeliveries]);

  // Open Stop
  const handleOpenStop = (del: DriverDelivery) => {
    setActiveDelivery(del);
    setScanStatusMsg(null);
    setCollectionMethod(del.payment_collection_method || 'cash');
    setCollectedAmount(String(del.cod_amount_expected));
    setMismatchReason('');
    setTimeout(() => scanInputRef.current?.focus(), 150);
  };

  // Start Run
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
        setActionMessage({ text: '🚀 Delivery Run Started! Orders are Out for Delivery.', type: 'success' });
        loadDriverDeliveries();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Scan Bag
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
          delivery_id: activeDelivery.delivery_id,
          scanned_code: code,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setScanStatusMsg({ text: `✅ Bag ${json.bag_sequence}/${json.total_bags} verified!`, type: 'success' });
        loadDriverDeliveries();
      } else {
        setScanStatusMsg({ text: `❌ ${json.message || json.error}`, type: 'error' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm Complete Delivery
  const handleConfirmDelivered = async () => {
    if (!activeDelivery || completingDelivery) return;

    const amount = parseFloat(collectedAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid collected COD amount.');
      return;
    }

    try {
      setCompletingDelivery(true);
      const res = await fetch('/api/delivery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: activeDelivery.order_id,
          collection_method: collectionMethod,
          collected_amount: amount,
          mismatch_reason: mismatchReason.trim() || null,
          driver_user_id: driverId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: `🎉 Delivery for ${activeDelivery.customer_name_snapshot} marked DELIVERED!`, type: 'success' });
        setActiveDelivery(null);
        loadDriverDeliveries();
      } else {
        alert(json.error || 'Failed to complete delivery');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingDelivery(false);
    }
  };

  // Report Delivery Failure
  const handleReportFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;

    try {
      const res = await fetch('/api/delivery/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_id: activeDelivery.delivery_id,
          failure_reason: failureReason,
          notes: failureNotes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowFailureModal(false);
        setFailureNotes('');
        setActiveDelivery(null);
        setActionMessage({ text: `Stop flagged as Failed.`, type: 'warning' });
        loadDriverDeliveries();
      } else {
        alert(json.error || 'Failed to record failure');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-pulse mb-4">
          <Truck className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Checking Driver Authorization...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-500">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Driver Access Required</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              This portal is restricted to active Sabjiwala delivery partners. Please log in with your verified driver phone number.
            </p>
          </div>
          <Link
            href="/"
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Storefront</span>
          </Link>
        </div>
      </div>
    );
  }

  const pendingStops = metrics?.pending || 0;
  const deliveredStops = metrics?.delivered || 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-24 font-sans">
      
      {/* Mobile-first Driver Header */}
      <header className="bg-slate-950 border-b border-slate-800 p-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-base font-extrabold text-white">
              Sabjiwala Driver &bull; <span className="text-emerald-400">{driverName}</span>
            </h1>
          </div>

          {isManagerOrOwner && (
            <Link
              href="/admin/dashboard"
              className="text-xs text-slate-400 hover:text-white font-bold"
            >
              Admin HQ &rarr;
            </Link>
          )}
        </div>

        {/* Driver selector for Owner / Manager only */}
        {isManagerOrOwner && driversList.length > 1 && (
          <div className="mt-2.5">
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl p-2 font-bold text-slate-200"
            >
              {driversList.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name} ({d.mobile})</option>
              ))}
            </select>
          </div>
        )}
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        
        {/* Route Status Strip */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Route</span>
            <span className="font-mono text-emerald-400 font-bold">{deliveredStops} / {metrics?.total || 0} Done</span>
          </div>

          <div className="text-xl font-black text-white font-mono">
            {pendingStops} {pendingStops === 1 ? 'Delivery Left' : 'Deliveries Left'}
          </div>

          {batch && batch.status === 'assigned' && (
            <button
              onClick={handleStartRun}
              className="w-full py-3 bg-emerald-600 active:scale-98 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2 min-h-[44px]"
            >
              <Truck className="w-4 h-4" />
              <span>Start Delivery Route 🚀</span>
            </button>
          )}
        </div>

        {actionMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Deliveries Stop List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase px-1">
            <span>Stops Queue ({deliveries.length})</span>
            <button onClick={loadDriverDeliveries} className="text-emerald-400 flex items-center gap-1 cursor-pointer min-h-[32px]">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 italic bg-slate-950 rounded-3xl border border-slate-800">
              No delivery stops assigned to you today.
            </div>
          ) : (
            deliveries.map((del, idx) => {
              const isDelivered = del.delivery_status === 'delivered';
              const isFailed = del.delivery_status === 'failed';

              return (
                <div
                  key={del.delivery_id}
                  className={`bg-slate-950 border rounded-3xl p-4 space-y-3 transition-all ${
                    isDelivered
                      ? 'border-emerald-800/80 bg-emerald-950/20 opacity-80'
                      : isFailed
                      ? 'border-rose-800/80 bg-rose-950/20'
                      : 'border-slate-800 hover:border-emerald-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-400">#{idx + 1}</span>
                        <h3 className="font-extrabold text-base text-white">
                          {del.customer_name_snapshot}
                        </h3>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{del.delivery_area_snapshot}</span>
                      </div>
                    </div>

                    <StatusChip status={del.delivery_status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-900">
                    <span className="text-slate-400">{del.total_bags_count} Bags &bull; {del.order_number}</span>
                    <span className="font-black text-emerald-400 text-sm">
                      COD ₹{del.cod_amount_expected.toFixed(0)}
                    </span>
                  </div>

                  {!isDelivered && !isFailed && (
                    <button
                      onClick={() => handleOpenStop(del)}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                    >
                      <span>Open Delivery Stop</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* ACTIVE STOP MODAL / BOTTOM SHEET */}
      {activeDelivery && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Stop #{activeDelivery.delivery_sequence} &bull; {activeDelivery.order_number}</span>
                <h3 className="text-lg font-black text-white">{activeDelivery.customer_name_snapshot}</h3>
              </div>
              <button onClick={() => setActiveDelivery(null)} aria-label="Close delivery modal" className="p-2 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fast Action Buttons: Call & Maps */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <a
                href={`tel:${activeDelivery.customer_mobile_snapshot}`}
                className="p-3 rounded-2xl bg-blue-600 text-white flex items-center justify-center gap-2 active:scale-98 min-h-[44px]"
              >
                <Phone className="w-4 h-4" />
                <span>Call Customer</span>
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${activeDelivery.delivery_flat_house_snapshot || ''} ${activeDelivery.delivery_society_street_snapshot} ${activeDelivery.delivery_area_snapshot} Halol`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-slate-800 text-white flex items-center justify-center gap-2 active:scale-98 min-h-[44px]"
              >
                <Navigation className="w-4 h-4 text-emerald-400" />
                <span>Open Map</span>
              </a>
            </div>

            {/* Address Box */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Delivery Address</span>
              <p className="text-slate-200 leading-relaxed">
                {activeDelivery.delivery_flat_house_snapshot && `${activeDelivery.delivery_flat_house_snapshot}, `}
                {activeDelivery.delivery_society_street_snapshot}, {activeDelivery.delivery_area_snapshot}, Halol
              </p>
            </div>

            {/* COD Collection Section */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Collect COD Amount</span>
                <span className="text-emerald-400 font-mono font-black text-base">
                  Target: ₹{activeDelivery.cod_amount_expected.toFixed(0)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCollectionMethod('cash')}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
                    collectionMethod === 'cash' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Cash (રોકડ)
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionMethod('upi_delivery')}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
                    collectionMethod === 'upi_delivery' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  UPI QR (પેમેન્ટ)
                </button>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] font-bold mb-1">Amount Collected (₹)</label>
                <input
                  type="number"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-base font-black text-white min-h-[44px]"
                />
              </div>
            </div>

            {/* Bag Scan Barcode Check */}
            <form onSubmit={handleScanBag} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Bag Scan Verification ({activeDelivery.total_bags_count} Bags)</span>
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="Scan bag barcode..."
                  value={scannedBagCode}
                  onChange={(e) => setScannedBagCode(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono min-h-[44px]"
                />
                <button type="submit" className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl cursor-pointer min-h-[44px]">
                  Scan
                </button>
              </div>
              {scanStatusMsg && (
                <div className={`text-[11px] font-bold ${scanStatusMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {scanStatusMsg.text}
                </div>
              )}
            </form>

            {/* Actions: Confirm Delivery & Report Issue */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmDelivered}
                disabled={completingDelivery}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black rounded-2xl text-sm shadow-md cursor-pointer flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>{completingDelivery ? 'Recording Delivery...' : `Confirm Delivered • ₹${collectedAmount} Collected`}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFailureModal(true)}
                className="w-full py-2.5 rounded-2xl border border-rose-800 text-rose-300 text-xs font-bold hover:bg-rose-950/40 min-h-[40px] cursor-pointer"
              >
                Delivery Problem / Customer Not Home
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Report Failure Modal */}
      {showFailureModal && activeDelivery && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4">
            <h3 className="font-extrabold text-white text-base">Report Delivery Failure</h3>
            
            <form onSubmit={handleReportFailure} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Reason</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white min-h-[44px]"
                >
                  <option value="customer_unavailable">Customer Not Available / House Locked</option>
                  <option value="phone_unreachable">Phone Switched Off / No Answer</option>
                  <option value="wrong_address">Wrong Address / Unable to Locate</option>
                  <option value="customer_refused">Customer Refused Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Driver Notes</label>
                <textarea
                  rows={2}
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white"
                  placeholder="Additional remarks..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowFailureModal(false)} className="px-3 py-2 text-slate-400 min-h-[36px] cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl min-h-[36px] cursor-pointer">
                  Flag as Failed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
