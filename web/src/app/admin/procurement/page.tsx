'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Truck, 
  Calendar, 
  Clock, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  TrendingUp, 
  Scale, 
  Layers, 
  FileText, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  Copy, 
  Check, 
  Building2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Share2,
  Boxes,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { StatusChip } from '@/components/ui/StatusChip';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

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
  supplier_id: string;
  supplier_name: string;
  purchased_qty: number;
  rate_per_unit: number;
  total_cost: number;
  mandi_lot_or_bill_no?: string;
  purchased_at: string;
  notes?: string;
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

interface BatchOrder {
  membership_id: string;
  order_id: string;
  order_number: string;
  confirmed_at: string;
  item_count: number;
  final_payable_amount: number;
  customer_name: string;
  area_locality: string;
  is_cancelled_post_lock: boolean;
  order_status: string;
  payment_status: string;
}

export default function ProcurementDashboard() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<{
    summary: BatchSummary;
    products: ProductRequirement[];
    orders: BatchOrder[];
    packing_queue: any[];
    exceptions: BatchOrder[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'demand' | 'purchasing' | 'receiving' | 'orders'>('demand');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [showLockModal, setShowLockModal] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // Purchase entry modal/inline state
  const [activePurchaseItem, setActivePurchaseItem] = useState<ProductRequirement | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_name: 'Halol APMC Trader',
    purchased_qty: '',
    rate_per_unit: '',
    bill_no: '',
    notes: '',
  });

  // Fetch batches list
  const loadBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/procurement/batches');
      const json = await res.json();
      if (json.success && json.data) {
        setBatches(json.data);
        if (json.data.length > 0 && !selectedBatchId) {
          setSelectedBatchId(json.data[0].id || json.data[0].batch_id);
        }
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBatchId]);

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
  }, [loadBatches]);

  useEffect(() => {
    if (selectedBatchId) {
      loadBatchDetails(selectedBatchId);
    }
  }, [selectedBatchId, loadBatchDetails]);

  // Lock Nightly Batch
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
        setActionMessage({ text: 'No eligible confirmed orders found for tomorrow before 8:00 PM cutoff.', type: 'info' });
      } else {
        setActionMessage({ text: json.error || 'Failed to lock procurement batch.', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error locking batch';
      setActionMessage({ text: msg, type: 'error' });
    } finally {
      setIsLocking(false);
    }
  };

  const handleSavePurchaseLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !activePurchaseItem) return;

    try {
      const payload = {
        batch_id: selectedBatchId,
        procurement_item_id: activePurchaseItem.procurement_item_id,
        supplier_name: purchaseForm.supplier_name,
        purchased_qty: parseFloat(purchaseForm.purchased_qty),
        rate_per_unit: parseFloat(purchaseForm.rate_per_unit),
        mandi_lot_or_bill_no: purchaseForm.bill_no,
        notes: purchaseForm.notes,
      };

      const res = await fetch('/api/procurement/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: `Recorded purchase for ${activePurchaseItem.product_name_gu || activePurchaseItem.product_name_en}`, type: 'success' });
        setActivePurchaseItem(null);
        setPurchaseForm({
          supplier_name: 'Halol APMC Trader',
          purchased_qty: '',
          rate_per_unit: '',
          bill_no: '',
          notes: '',
        });
        loadBatchDetails(selectedBatchId);
      } else {
        setActionMessage({ text: json.error || 'Failed to save purchase entry.', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving purchase';
      setActionMessage({ text: msg, type: 'error' });
    }
  };

  const handleCopyWhatsApp = () => {
    if (!batchData) return;
    const prods = batchData.products || [];
    let text = `*🌿 TAAZATOKRA - MANDI PROCUREMENT SHEET*\n`;
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

  const toggleExpandProduct = (id: string) => {
    setExpandedProductIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const summary = batchData?.summary;
  const products = batchData?.products || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        
        {/* Top Summary Banner: Tomorrow's Delivery & Batch Lock */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Procurement & Mandi Buying (શાકભાજી ખરીદી)
              </span>
              {summary && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
                  {summary.batch_number}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              Tomorrow&apos;s Delivery &bull; <span className="text-emerald-600 dark:text-emerald-400">{summary?.total_orders_count || 0} Orders</span> &bull; <span className="font-normal text-slate-500">{products.length} Products</span>
            </h1>
          </div>

          {/* Top Actions: WhatsApp Mandi Sheet & Lock Batch */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              disabled={products.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100 shadow-2xs"
            >
              {copiedWhatsApp ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedWhatsApp ? 'Copied WhatsApp Text!' : 'WhatsApp Sheet'}</span>
            </button>

            <a
              href={`/api/reports/export?type=procurement${selectedBatchId ? `&batch_id=${selectedBatchId}` : ''}`}
              download
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 shadow-2xs"
              title="Download procurement list in Excel"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Excel Sheet (એક્સેલ)</span>
            </a>

            {summary?.status === 'locked' ? (
              <div className="px-3.5 py-2 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span>Locked (8 PM Cutoff)</span>
              </div>
            ) : (
              <button
                onClick={() => setShowLockModal(true)}
                disabled={isLocking}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Lock className="w-4 h-4" />
                <span>{isLocking ? 'Locking Batch...' : 'Lock Tonight Batch'}</span>
              </button>
            )}
          </div>
        </div>

        {actionMessage && (
          <div className={`p-4 rounded-2xl text-xs flex items-center gap-2 border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl text-xs font-bold w-fit shadow-2xs">
          <button
            onClick={() => setActiveTab('demand')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'demand'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Product Demand ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('purchasing')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'purchasing'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Log APMC Purchases
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Batch Orders ({batchData?.orders?.length || 0})
          </button>
        </div>

        {/* MAIN PRODUCT DEMAND VIEW */}
        {activeTab === 'demand' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
            
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-slate-700 dark:text-slate-300">Mandatory Mandi Buy List</span>
              <span>Click product to view purchase history & supplier breakdown</span>
            </div>

            {products.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                <div className="font-bold text-slate-700 dark:text-slate-300">No locked products for this batch</div>
                <div className="text-[11px] text-slate-500">Lock the batch after 8 PM to freeze required demand.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => {
                  const isExpanded = !!expandedProductIds[p.procurement_item_id];
                  const need = Number(p.required_qty || 0);
                  const suggested = Number(p.suggested_procurement_qty || need);
                  const procured = Number(p.procured_qty || 0);
                  const isFullyProcured = procured >= need && need > 0;

                  return (
                    <div key={p.procurement_item_id} className="p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Main Clean Row */}
                      <div
                        onClick={() => toggleExpandProduct(p.procurement_item_id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                      >
                        {/* Name & Unit */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-lg shrink-0">
                            🥬
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-sm">
                              {p.product_name_gu} <span className="font-normal text-slate-500">({p.product_name_en})</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Unit: {p.base_unit_name_gu || p.base_unit_code}
                            </div>
                          </div>
                        </div>

                        {/* Numbers: Need vs Suggested vs Procured */}
                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Need</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {need} {p.base_unit_code}
                            </span>
                          </div>

                          <div className="text-right bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold block">Suggested (+Buffer)</span>
                            <span className="font-mono font-black text-emerald-950 dark:text-emerald-200 text-sm">
                              {suggested} {p.base_unit_code}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Procured</span>
                            <span className={`font-mono font-bold ${isFullyProcured ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {procured} {p.base_unit_code}
                            </span>
                          </div>

                          <div className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Progressive Disclosure Accordion: Supplier & Cost Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-4 rounded-2xl space-y-3 text-xs animate-in fade-in duration-100">
                          <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                            <span>Supplier Purchase Lines & Mandi Rates</span>
                            <button
                              type="button"
                              onClick={() => {
                                setActivePurchaseItem(p);
                                setActiveTab('purchasing');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Log Purchase for {p.product_name_gu}</span>
                            </button>
                          </div>

                          {(p.purchase_lines || []).length === 0 ? (
                            <div className="text-[11px] text-slate-400 italic">
                              No purchase lines recorded yet. Click &quot;Log Purchase&quot; to enter mandi lot rate.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {p.purchase_lines.map((line) => (
                                <div key={line.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-mono">
                                  <div>
                                    <span className="font-bold text-slate-900 dark:text-white">{line.supplier_name}</span>
                                    {line.mandi_lot_or_bill_no && <span className="text-slate-400 ml-2">Bill: {line.mandi_lot_or_bill_no}</span>}
                                  </div>
                                  <div>
                                    <span>{line.purchased_qty} {p.base_unit_code} @ ₹{line.rate_per_unit}/{p.base_unit_code} = </span>
                                    <span className="font-black text-emerald-600">₹{line.total_cost}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* LOG PURCHASES TAB */}
        {activeTab === 'purchasing' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs max-w-2xl space-y-4">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Record APMC Purchase Entry (મંડી ખરીદી એન્ટ્રી)
            </h3>
            
            <form onSubmit={handleSavePurchaseLine} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Select Product</label>
                <select
                  value={activePurchaseItem?.procurement_item_id || ''}
                  onChange={(e) => {
                    const sel = products.find((p) => p.procurement_item_id === e.target.value);
                    setActivePurchaseItem(sel || null);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-bold"
                  required
                >
                  <option value="">-- Choose Vegetable --</option>
                  {products.map((p) => (
                    <option key={p.procurement_item_id} value={p.procurement_item_id}>
                      {p.product_name_gu} ({p.product_name_en}) - Need: {p.suggested_procurement_qty || p.required_qty} {p.base_unit_code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Purchased Qty</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 35"
                    value={purchaseForm.purchased_qty}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchased_qty: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Rate per Unit (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 18"
                    value={purchaseForm.rate_per_unit}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, rate_per_unit: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Supplier / Mandi Trader</label>
                <input
                  type="text"
                  value={purchaseForm.supplier_name}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Bill / Lot Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. LOT-402"
                  value={purchaseForm.bill_no}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, bill_no: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Save Purchase Line &bull; ₹{(parseFloat(purchaseForm.purchased_qty || '0') * parseFloat(purchaseForm.rate_per_unit || '0')).toFixed(0)} Total
              </button>
            </form>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              Orders Locked in this Batch ({batchData?.orders?.length || 0})
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(batchData?.orders || []).map((o) => (
                <div key={o.order_id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mr-2">{o.order_number}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{o.customer_name}</span>
                    <span className="text-slate-400 ml-2">&bull; {o.area_locality}</span>
                  </div>

                  <div className="font-mono font-black text-slate-900 dark:text-white">
                    ₹{Number(o.final_payable_amount || 0).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Lock Batch Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLockModal}
        onClose={() => setShowLockModal(false)}
        onConfirm={handleLockBatch}
        title="Lock 8:00 PM Procurement Batch"
        message="Locking the batch freezes customer order demand for tomorrow morning delivery so mandi buying can begin without quantities changing. Proceed?"
        confirmLabel="Lock Batch Now"
        isLoading={isLocking}
      />

    </div>
  );
}
