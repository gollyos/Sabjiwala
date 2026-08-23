'use client';

import { getErrorMessage } from '@/lib/errors';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Lock, CheckCircle2, AlertCircle, Check, Share2, PlusCircle } from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { todayIST } from '@/lib/istDate';

interface BatchSummary {
  id?: string;
  batch_id?: string;
  batch_number: string;
  batch_date: string;
  cutoff_timestamp: string;
  status: string;
  total_orders_count: number;
  unique_customers_count: number;
  gross_merchandise_total: number;
  first500_discounts_total: number;
  cod_discounts_total: number;
  expected_cod_collection_total: number;
  total_weight_kg: number;
  total_bunch_count: number;
  total_piece_count: number;
  total_products_count: number;
  total_procurement_cost: number;
  total_received_weight_kg: number;
  total_usable_weight_kg: number;
  total_wastage_weight_kg: number;
  locked_at: string;
}

interface PurchaseLine {
  id: string;
  supplier_id?: string;
  supplier_name: string;
  purchased_qty: number;
  rate_per_unit: number;
  total_cost: number;
  mandi_lot_or_bill_no?: string;
  purchased_at?: string;
  created_at?: string;
  notes?: string;
  procurement_items?: {
    product_id: string;
    products?: {
      name_en: string;
      name_gu: string;
      image_url?: string;
    };
  };
}

interface ProductRequirement {
  procurement_item_id: string;
  product_id: string;
  product_name_en: string;
  product_name_gu: string;
  image_url?: string;
  category_name_en: string;
  base_unit_code: string;
  base_unit_name_en: string;
  base_unit_name_gu: string;
  required_qty: number;
  suggested_procurement_qty: number;
  cancelled_after_lock_qty: number;
  adjusted_operational_qty: number;
  procured_qty: number;
  received_qty: number;
  usable_qty: number;
  wastage_qty: number;
  total_procurement_cost: number;
  effective_cost_per_usable_unit?: number;
  preferred_supplier_id?: string;
  preferred_supplier_name?: string;
  preferred_supplier_mandi?: string;
  latest_mandi_rate: number;
  estimated_purchase_cost: number;
  purchase_lines: PurchaseLine[];
}

export default function ProcurementDashboard() {
  const [supabase] = useState(() => createClient());
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<{
    summary: BatchSummary;
    products: ProductRequirement[];
    orders: any[];
    packing_queue: any[];
    exceptions: any[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'demand' | 'purchasing' | 'purchases_log' | 'receiving'>('demand');
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [showLockModal, setShowLockModal] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);

  // All catalog products for quick purchase entry
  const [catalogProducts, setCatalogProducts] = useState<Array<{ id: string; name_en: string; name_gu: string; base_unit_code: string }>>([]);
  const [showQuickPurchaseModal, setShowQuickPurchaseModal] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseLine[]>([]);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);

  // Quick Purchase Form State
  const [purchaseForm, setPurchaseForm] = useState({
    product_id: '',
    product_name: '',
    purchased_qty: '',
    unit_code: 'kg',
    rate_per_unit: '',
    supplier_name: 'Halol APMC Mandi',
    bill_no: '',
    purchase_date: todayIST(),
    notes: '',
  });

  // Mandi rates saved on the Mandi Rates screen for the selected purchase
  // date, used to auto-fill the purchase rate. Keyed by product id.
  const [mandiRateMap, setMandiRateMap] = useState<Record<string, number>>({});
  const [rateHint, setRateHint] = useState<string | null>(null);
  // Last value we auto-filled, so switching products replaces the suggestion
  // but never clobbers a rate the user typed manually.
  const autoFilledRateRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('get_daily_mandi_rates', {
          p_rate_date: purchaseForm.purchase_date,
        });
        if (cancelled) return;
        const map: Record<string, number> = {};
        ((data as { product_id: string; purchase_rate_per_kg: number }[]) || []).forEach((r) => {
          map[r.product_id] = Number(r.purchase_rate_per_kg);
        });
        setMandiRateMap(map);
      } catch (err) {
        // Rates storage not set up yet (migration pending) — prefill simply
        // stays unavailable; manual rate entry always works.
        console.warn('Daily mandi rates unavailable for auto-fill:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, purchaseForm.purchase_date]);

  // Fetch batches list
  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/procurement/batches');
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.length > 0 && !selectedBatchId) {
          setSelectedBatchId(json.data[0].id || json.data[0].batch_id);
        }
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  }, [selectedBatchId]);

  // Fetch catalog products
  const loadCatalog = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select(`id, name_en, name_gu, product_units!products_base_unit_id_fkey(code)`)
        .eq('is_active', true)
        .order('name_en', { ascending: true });

      if (data) {
        const formatted = data.map((p: any) => ({
          id: p.id,
          name_en: p.name_en,
          name_gu: p.name_gu,
          base_unit_code: p.product_units?.code || 'kg',
        }));
        setCatalogProducts(formatted);
      }
    } catch (err) {
      console.error('Error loading catalog products:', err);
    }
  }, [supabase]);

  // Fetch recent purchases log
  const loadRecentPurchases = useCallback(async () => {
    try {
      const res = await fetch('/api/procurement/purchase-entry?limit=50');
      const json = await res.json();
      if (json.success && json.data) {
        setRecentPurchases(json.data);
      }
    } catch (err) {
      console.error('Error loading purchases log:', err);
    }
  }, []);

  // Fetch specific batch details
  const loadBatchDetails = useCallback(async (batchId: string) => {
    try {
      const res = await fetch(`/api/procurement/batch/${batchId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setBatchData(json.data);
      }
    } catch (err) {
      console.error('Error loading batch details:', err);
    }
  }, []);

  useEffect(() => {
    loadBatches();
    loadCatalog();
    loadRecentPurchases();
  }, [loadBatches, loadCatalog, loadRecentPurchases]);

  useEffect(() => {
    if (selectedBatchId) {
      loadBatchDetails(selectedBatchId);
    }
  }, [selectedBatchId, loadBatchDetails]);

  // Lock Nightly Batch (7:50 PM Cutoff)
  const handleLockBatch = async () => {
    setIsLocking(true);
    setActionMessage(null);
    setShowLockModal(false);
    try {
      const res = await fetch('/api/procurement/lock-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();
      if (json.success) {
        if (json.data?.lock_status?.status === 'ALREADY_LOCKED') {
          setActionMessage({ text: 'Batch for tomorrow is already locked. Displaying frozen quantities.', type: 'info' });
        } else {
          setActionMessage({ text: 'Procurement batch locked successfully! Order demand frozen for tomorrow morning.', type: 'success' });
        }
        await loadBatches();
        if (json.data?.lock_status?.batch_id) {
          setSelectedBatchId(json.data.lock_status.batch_id);
        }
      } else if (json.error_code === 'NO_ELIGIBLE_ORDERS') {
        setActionMessage({ text: 'No eligible confirmed orders found for tomorrow before 7:50 PM cutoff.', type: 'info' });
      } else {
        setActionMessage({ text: json.error || 'Failed to lock procurement batch.', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? getErrorMessage(err) : 'Error locking batch';
      setActionMessage({ text: msg, type: 'error' });
    } finally {
      setIsLocking(false);
    }
  };

  // Submit Direct Purchase Entry
  const handleSavePurchaseEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.product_id || !purchaseForm.purchased_qty || !purchaseForm.rate_per_unit) {
      setActionMessage({ text: 'Please select product, quantity, and purchase rate.', type: 'error' });
      return;
    }

    setIsSavingPurchase(true);
    setActionMessage(null);

    const qty = parseFloat(purchaseForm.purchased_qty);
    const rate = parseFloat(purchaseForm.rate_per_unit);
    const totalCost = qty * rate;

    try {
      const res = await fetch('/api/procurement/purchase-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: purchaseForm.product_id,
          product_name: purchaseForm.product_name,
          purchased_qty: qty,
          unit_code: purchaseForm.unit_code,
          rate_per_unit: rate,
          total_cost: totalCost,
          supplier_name: purchaseForm.supplier_name,
          mandi_lot_or_bill_no: purchaseForm.bill_no,
          purchase_date: purchaseForm.purchase_date,
          notes: purchaseForm.notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: `Recorded purchase: ${qty} ${purchaseForm.unit_code} of ${purchaseForm.product_name} at ₹${rate}/kg (Total: ₹${totalCost})`, type: 'success' });
        setShowQuickPurchaseModal(false);
        autoFilledRateRef.current = '';
        setRateHint(null);
        setPurchaseForm({
          product_id: '',
          product_name: '',
          purchased_qty: '',
          unit_code: 'kg',
          rate_per_unit: '',
          supplier_name: 'Halol APMC Mandi',
          bill_no: '',
          purchase_date: todayIST(),
          notes: '',
        });
        loadRecentPurchases();
        if (selectedBatchId) {
          loadBatchDetails(selectedBatchId);
        }
      } else {
        setActionMessage({ text: json.error || 'Failed to save purchase entry.', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Error recording purchase.', type: 'error' });
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const handleCopyWhatsApp = () => {
    if (!batchData) return;
    const prods = batchData.products || [];
    let text = `*🌿 TAJI TOKRI - MANDI PROCUREMENT SHEET*\n`;
    text += `*Batch:* ${batchData.summary.batch_number} (${batchData.summary.batch_date})\n`;
    text += `*Total Orders:* ${batchData.summary.total_orders_count} | *Products:* ${prods.length}\n`;
    text += `----------------------------------------\n`;
    prods.forEach((p, idx) => {
      text += `${idx + 1}. *${p.product_name_gu}* (${p.product_name_en})\n`;
      text += `   👉 Need: *${p.suggested_procurement_qty || p.required_qty} ${p.base_unit_code}*\n`;
    });
    text += `----------------------------------------\n`;
    text += `_Generated at Halol Godown_\n`;

    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  const summary = batchData?.summary;
  const products = batchData?.products || [];

  // Calculate total spent today from recent purchases
  const totalSpentToday = recentPurchases.reduce((sum, p) => sum + (p.total_cost || (p.purchased_qty * p.rate_per_unit) || 0), 0);
  const totalQtyToday = recentPurchases.reduce((sum, p) => sum + (p.purchased_qty || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Top Header Card */}
        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Procurement &amp; Mandi Buying (ખરીદી સંચાલન)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
              Mandi Procurement &amp; Purchase Log
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Record APMC purchases, monitor live midnight customer demand, and calculate purchase margins.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Direct Purchase Entry Button */}
            <button
              type="button"
              onClick={() => setShowQuickPurchaseModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-extrabold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Record Purchase (ખરીદી ઉમેરો)</span>
            </button>

            {/* Lock Batch Button */}
            <button
              type="button"
              onClick={() => setShowLockModal(true)}
              disabled={isLocking}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLocking ? 'Locking...' : 'Lock Midnight Batch (7:50 PM)'}</span>
            </button>

            {/* WhatsApp Sheet Copy */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
              title="Copy Procurement Sheet for WhatsApp"
            >
              {copiedWhatsApp ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>WhatsApp Sheet</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-150 ${
            actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            actionMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* KPI Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today&apos;s Total Purchase</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              ₹{totalSpentToday.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Recorded mandi expense</div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Weight Procured</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 font-mono">
              {totalQtyToday.toFixed(1)} <span className="text-sm font-semibold text-slate-500">kg/units</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Across all items</div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Batch Demand</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              {summary ? `${summary.total_weight_kg || 0} kg` : '0 kg'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{summary?.total_orders_count || 0} customer orders</div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Batch Status</div>
            <div className="mt-1">
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                {summary?.status || 'Open (Live)'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">7:50 PM IST Cutoff</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-extrabold pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('demand')}
            className={`py-2.5 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'demand'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📋 Customer Demand Sheet ({products.length} items)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('purchases_log')}
            className={`py-2.5 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'purchases_log'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            💰 Direct Purchases Log ({recentPurchases.length} records)
          </button>
        </div>

        {/* TAB 1: Customer Demand Sheet */}
        {activeTab === 'demand' && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Required Produce for Tomorrow Morning Delivery
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculated automatically from confirmed customer orders before 7:50 PM cutoff.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Product (વસ્તુ)</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5 text-right">Customer Demand</th>
                    <th className="px-5 py-3.5 text-right">Suggested Purchase</th>
                    <th className="px-5 py-3.5 text-right">Mandi Rate</th>
                    <th className="px-5 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500 font-medium">
                        No customer demand recorded yet for tomorrow. Click &quot;Record Purchase&quot; to log ad-hoc purchases.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.procurement_item_id || p.product_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          <div>{p.product_name_gu || p.product_name_en}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{p.product_name_en}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{p.category_name_en || 'Vegetables'}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                          {p.required_qty} {p.base_unit_code}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-700">
                          {p.suggested_procurement_qty || p.required_qty} {p.base_unit_code}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-700">
                          ₹{p.latest_mandi_rate || 0}/{p.base_unit_code}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const dailyRate = mandiRateMap[p.product_id];
                              setPurchaseForm({
                                product_id: p.product_id,
                                product_name: `${p.product_name_gu} (${p.product_name_en})`,
                                purchased_qty: String(p.suggested_procurement_qty || p.required_qty || ''),
                                unit_code: p.base_unit_code || 'kg',
                                // Today's saved mandi rate wins; fall back to
                                // the item's last known rate.
                                rate_per_unit: String(dailyRate ?? p.latest_mandi_rate ?? ''),
                                supplier_name: p.preferred_supplier_name || 'Halol APMC Mandi',
                                bill_no: '',
                                purchase_date: todayIST(),
                                notes: '',
                              });
                              autoFilledRateRef.current = dailyRate !== undefined ? String(dailyRate) : '';
                              setRateHint(dailyRate !== undefined
                                ? `Auto-filled from Mandi Rates screen (${todayIST()}) — ₹${dailyRate}/kg`
                                : null);
                              setShowQuickPurchaseModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          >
                            + Record Entry
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Direct Purchases Log */}
        {activeTab === 'purchases_log' && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Recorded Mandi Purchases &amp; Invoices
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full log of quantities, rates, suppliers, and total costs entered by owner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickPurchaseModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs"
              >
                + New Purchase Entry
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Product Name</th>
                    <th className="px-5 py-3.5">Supplier / Mandi Trader</th>
                    <th className="px-5 py-3.5 text-right">Quantity</th>
                    <th className="px-5 py-3.5 text-right">Rate (₹/Unit)</th>
                    <th className="px-5 py-3.5 text-right">Total Cost (₹)</th>
                    <th className="px-5 py-3.5">Bill / Lot #</th>
                    <th className="px-5 py-3.5">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium">
                        No purchases recorded yet. Click &quot;+ Record Purchase&quot; to log your mandi buying!
                      </td>
                    </tr>
                  ) : (
                    recentPurchases.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          {item.procurement_items?.products?.name_gu ? (
                            <>
                              <div>{item.procurement_items.products.name_gu}</div>
                              <div className="text-[11px] text-slate-500 font-normal">{item.procurement_items.products.name_en}</div>
                            </>
                          ) : (
                            item.notes?.split('Direct entry for ')[1]?.split(' (')[0] || 'Produce Item'
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 font-medium">
                          {item.supplier_name || 'Halol APMC Mandi'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                          {item.purchased_qty} kg
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-700">
                          ₹{item.rate_per_unit}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-black text-emerald-700 text-sm">
                          ₹{(item.total_cost || (item.purchased_qty * item.rate_per_unit)).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-500 text-[11px]">
                          {item.mandi_lot_or_bill_no || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* QUICK MANDI PURCHASE ENTRY MODAL */}
      {showQuickPurchaseModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-600" />
                  <span>Record Mandi Purchase (ખરીદી એન્ટ્રી)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter quantity, rate, and supplier details for today&apos;s produce.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickPurchaseModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePurchaseEntry} className="space-y-4">
              
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Item (શાકભાજી / ફળ) *
                </label>
                <select
                  value={purchaseForm.product_id}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const prod = catalogProducts.find((p) => p.id === selId);
                    const dailyRate = selId ? mandiRateMap[selId] : undefined;
                    // Replace a previous auto-fill (or empty box) with this
                    // product's saved mandi rate; keep manually typed rates.
                    const rateIsAuto = purchaseForm.rate_per_unit === ''
                      || purchaseForm.rate_per_unit === autoFilledRateRef.current;
                    const nextRate = rateIsAuto && dailyRate !== undefined
                      ? String(dailyRate)
                      : (rateIsAuto ? '' : purchaseForm.rate_per_unit);
                    autoFilledRateRef.current = rateIsAuto && dailyRate !== undefined ? nextRate : '';
                    setRateHint(rateIsAuto && dailyRate !== undefined
                      ? `Auto-filled from Mandi Rates screen (${purchaseForm.purchase_date}) — ₹${dailyRate}/kg`
                      : null);
                    setPurchaseForm({
                      ...purchaseForm,
                      product_id: selId,
                      product_name: prod ? `${prod.name_gu} (${prod.name_en})` : '',
                      unit_code: prod?.base_unit_code || 'kg',
                      rate_per_unit: nextRate,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                >
                  <option value="">-- Choose Product from Catalog --</option>
                  {catalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_gu} ({p.name_en}) - [{p.base_unit_code}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity and Rate Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purchased Quantity ({purchaseForm.unit_code}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="e.g. 50"
                    value={purchaseForm.purchased_qty}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchased_qty: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purchase Rate (₹/{purchaseForm.unit_code}) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 22"
                    value={purchaseForm.rate_per_unit}
                    onChange={(e) => {
                      autoFilledRateRef.current = '';
                      setRateHint(null);
                      setPurchaseForm({ ...purchaseForm, rate_per_unit: e.target.value });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                  {rateHint && (
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">{rateHint}</p>
                  )}
                </div>
              </div>

              {/* Auto Total Calculation Display */}
              {purchaseForm.purchased_qty && purchaseForm.rate_per_unit && (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Total Purchase Expense:</span>
                  <span className="text-base font-black text-emerald-800 font-mono">
                    ₹{(parseFloat(purchaseForm.purchased_qty || '0') * parseFloat(purchaseForm.rate_per_unit || '0')).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {/* Supplier & Bill Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mandi Supplier / Trader
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Halol APMC Trader"
                    value={purchaseForm.supplier_name}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Bill / Lot No. (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LOT-402"
                    value={purchaseForm.bill_no}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, bill_no: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickPurchaseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPurchase}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingPurchase ? 'Saving...' : 'Save Purchase Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOCK BATCH CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={showLockModal}
        title="Lock Midnight Procurement Batch?"
        message="Locking the batch will aggregate all orders placed before the 7:50 PM cutoff for tomorrow morning delivery and freeze purchase requirements."
        confirmLabel="Yes, Lock Batch"
        cancelLabel="Cancel"
        onConfirm={handleLockBatch}
        onClose={() => setShowLockModal(false)}
      />

    </div>
  );
}
