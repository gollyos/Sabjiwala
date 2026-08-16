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
  Banknote, 
  Tag, 
  Scale, 
  Layers, 
  FileText, 
  RefreshCw, 
  ChevronRight, 
  Plus, 
  Copy, 
  Check, 
  Building2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';

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
  cancelled_at_post_lock?: string;
  cancellation_reason_post_lock?: string;
  is_manual_override: boolean;
  override_reason?: string;
  order_status: string;
  payment_status: string;
}

interface PackingItem {
  product_name_en: string;
  product_name_gu: string;
  variant_name_en: string;
  variant_name_gu: string;
  quantity: number;
  unit_code: string;
  line_total: number;
}

interface PackingOrder {
  order_id: string;
  order_number: string;
  customer_name: string;
  area_locality: string;
  final_payable_amount: number;
  is_cancelled_post_lock: boolean;
  items: PackingItem[];
}

export default function ProcurementDashboard() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<{
    summary: BatchSummary;
    products: ProductRequirement[];
    orders: BatchOrder[];
    packing_queue: PackingOrder[];
    exceptions: BatchOrder[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'summary' | 'products' | 'purchasing' | 'orders' | 'packing' | 'whatsapp'>('summary');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);

  // New purchase entry modal/inline state
  const [activePurchaseItem, setActivePurchaseItem] = useState<ProductRequirement | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_name: 'Patel Vegetable Traders',
    purchased_qty: '',
    rate_per_unit: '',
    bill_no: '',
    notes: '',
  });

  // Receiving entry state
  const [activeReceivingItem, setActiveReceivingItem] = useState<ProductRequirement | null>(null);
  const [receivingForm, setReceivingForm] = useState({
    received_qty: '',
    usable_qty: '',
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
          setSelectedBatchId(json.data[0].id);
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
    if (!confirm('Are you sure you want to lock the 8:00 PM procurement batch for tomorrow morning delivery?')) {
      return;
    }

    setIsLocking(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/procurement/lock-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();
      if (json.success) {
        if (json.data?.lock_status?.status === 'ALREADY_LOCKED') {
          setActionMessage({ text: 'Batch for tomorrow is already locked. Displaying frozen details.', type: 'info' });
        } else {
          setActionMessage({ text: 'Procurement batch locked successfully! Orders and product demand frozen.', type: 'success' });
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

  // Submit Supplier Purchase Line
  const handleSavePurchaseLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePurchaseItem) return;

    try {
      const res = await fetch('/api/procurement/purchase-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procurement_item_id: activePurchaseItem.procurement_item_id,
          purchased_qty: Number(purchaseForm.purchased_qty),
          rate_per_unit: Number(purchaseForm.rate_per_unit),
          mandi_lot_or_bill_no: purchaseForm.bill_no,
          notes: purchaseForm.notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: `Recorded purchase for ${activePurchaseItem.product_name_en}.`, type: 'success' });
        setActivePurchaseItem(null);
        setPurchaseForm({ supplier_name: 'Patel Vegetable Traders', purchased_qty: '', rate_per_unit: '', bill_no: '', notes: '' });
        if (selectedBatchId) loadBatchDetails(selectedBatchId);
      } else {
        alert(json.error || 'Failed to save purchase');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving purchase entry');
    }
  };

  // Submit Receiving & Wastage
  const handleSaveReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReceivingItem) return;

    try {
      const res = await fetch('/api/procurement/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procurement_item_id: activeReceivingItem.procurement_item_id,
          received_qty: Number(receivingForm.received_qty),
          usable_qty: Number(receivingForm.usable_qty),
          notes: receivingForm.notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ text: `Recorded receiving & wastage for ${activeReceivingItem.product_name_en}.`, type: 'success' });
        setActiveReceivingItem(null);
        setReceivingForm({ received_qty: '', usable_qty: '', notes: '' });
        if (selectedBatchId) loadBatchDetails(selectedBatchId);
      } else {
        alert(json.error || 'Failed to record receiving');
      }
    } catch (err) {
      console.error(err);
      alert('Error recording receiving');
    }
  };

  // Generate Clean WhatsApp Summary Text
  const generateWhatsAppReport = () => {
    if (!batchData) return '';
    const { summary, products } = batchData;

    let text = `🥦 *SABJIWALA — OWNER PROCUREMENT REPORT*\n`;
    text += `📅 *Delivery Date:* ${new Date(summary.batch_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n`;
    text += `⏰ *Slot:* 10:00 AM – 01:00 PM (Halol)\n`;
    text += `📦 *Batch Number:* ${summary.batch_number}\n`;
    text += `🔒 *Status:* ${summary.status.toUpperCase()}\n\n`;

    text += `📊 *EXECUTIVE SALES SUMMARY:*\n`;
    text += `• Total Confirmed Orders: ${summary.total_orders_count}\n`;
    text += `• Unique Customers: ${summary.unique_customers_count}\n`;
    text += `• Gross Merchandise Subtotal: ₹${Number(summary.gross_merchandise_total).toFixed(2)}\n`;
    text += `• FIRST500 Discounts: -₹${Number(summary.first500_discounts_total).toFixed(2)}\n`;
    text += `• COD (2%) Discounts: -₹${Number(summary.cod_discounts_total).toFixed(2)}\n`;
    text += `• *Expected Cash Collection:* ₹${Number(summary.expected_cod_collection_total).toFixed(2)}\n\n`;

    text += `⚖️ *TOTAL QUANTITIES:*\n`;
    text += `• Total Weight (kg): ${Number(summary.total_weight_kg).toFixed(1)} kg\n`;
    text += `• Total Bunches: ${summary.total_bunch_count}\n`;
    text += `• Total Pieces: ${summary.total_piece_count}\n`;
    text += `• Total Products to Procure: ${summary.total_products_count}\n\n`;

    text += `🛒 *MANDI PROCUREMENT REQUIREMENTS:*\n`;
    products.forEach((p, idx) => {
      text += `${idx + 1}. *${p.product_name_gu}* (${p.product_name_en})\n`;
      text += `   Demand: ${p.required_qty} ${p.base_unit_code} | *Buy: ${p.suggested_procurement_qty} ${p.base_unit_code}*\n`;
      if (p.preferred_supplier_name) {
        text += `   Supplier: ${p.preferred_supplier_name} @ ₹${p.latest_mandi_rate}/${p.base_unit_code} (~₹${p.estimated_purchase_cost})\n`;
      }
    });

    text += `\n🔗 *Admin Portal:* https://sabjiwala.app/admin/procurement\n`;
    return text;
  };

  const copyToClipboard = () => {
    const text = generateWhatsAppReport();
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  const currentSummary = batchData?.summary;

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
                <span>Procurement & Mandi Planning</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700/50 font-mono">
                  8:00 PM IST CUTOFF
                </span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Halol APMC Mandi Sourcing • Frozen Confirmed Order Requirements
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/pricing"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            Daily Pricing
          </Link>
          <Link
            href="/admin/products"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            Catalog
          </Link>
          <button
            onClick={handleLockBatch}
            disabled={isLocking}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLocking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Locking 8 PM Batch...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Lock Tomorrow&apos;s Batch</span>
              </>
            )}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`max-w-7xl mx-auto mb-6 p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-3 animate-fade-in ${
          actionMessage.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' :
          actionMessage.type === 'error' ? 'bg-red-950/60 border-red-500/50 text-red-200' :
          'bg-blue-950/60 border-blue-500/50 text-blue-200'
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
        
        {/* Batch Selector Header Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-300">Selected Batch Date:</span>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs sm:text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {batches.map((b) => (
                <option key={b.id || b.batch_id || b.batch_number} value={b.id || b.batch_id || ''}>
                  {new Date(b.batch_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {b.batch_number} ({b.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Status:</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
              currentSummary?.status === 'locked' ? 'bg-amber-950 text-amber-300 border border-amber-600/40' :
              currentSummary?.status === 'procured' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40' :
              'bg-slate-800 text-slate-300'
            }`}>
              {currentSummary?.status?.toUpperCase() || 'NO BATCH'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'summary', label: 'Executive Summary', icon: TrendingUp },
            { id: 'products', label: 'Mandi Procurement List', icon: Package },
            { id: 'purchasing', label: 'Supplier Purchases & Wastage', icon: Building2 },
            { id: 'orders', label: `Frozen Orders (${currentSummary?.total_orders_count || 0})`, icon: Layers },
            { id: 'packing', label: 'Packing Preparation', icon: Truck },
            { id: 'whatsapp', label: 'WhatsApp Report', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: EXECUTIVE SUMMARY */}
        {activeTab === 'summary' && currentSummary && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Total Orders</span>
                  <Layers className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{currentSummary.total_orders_count}</div>
                <div className="text-[10px] text-slate-500 mt-1">Confirmed & Frozen</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Unique Customers</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{currentSummary.unique_customers_count}</div>
                <div className="text-[10px] text-slate-500 mt-1">Halol Households</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Gross Sales</span>
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-black text-white font-mono">₹{Number(currentSummary.gross_merchandise_total).toFixed(0)}</div>
                <div className="text-[10px] text-slate-500 mt-1">Merchandise Subtotal</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>FIRST500 (10%)</span>
                  <Tag className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-black text-amber-300 font-mono">-₹{Number(currentSummary.first500_discounts_total).toFixed(0)}</div>
                <div className="text-[10px] text-slate-500 mt-1">Launch Offer Savings</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>COD (2%)</span>
                  <Banknote className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-300 font-mono">-₹{Number(currentSummary.cod_discounts_total).toFixed(0)}</div>
                <div className="text-[10px] text-slate-500 mt-1">Cash Payment Discount</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-600/40">
                <div className="flex items-center justify-between text-emerald-400 mb-1 text-xs font-bold">
                  <span>Expected Collection</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-300 font-mono">₹{Number(currentSummary.expected_cod_collection_total).toFixed(0)}</div>
                <div className="text-[10px] text-emerald-400 mt-1">Cash to collect at doorstep</div>
              </div>
            </div>

            {/* Weights & Units Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl">
                  <Scale className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase">Weight Products Demand</div>
                  <div className="text-2xl font-black text-white font-mono mt-0.5">{Number(currentSummary.total_weight_kg).toFixed(1)} kg</div>
                  <div className="text-xs text-slate-500">Tomato, Potato, Bhindi, Bottle Gourd, etc.</div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl">
                  <Package className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase">Bunch / Bundle Herbs</div>
                  <div className="text-2xl font-black text-white font-mono mt-0.5">{currentSummary.total_bunch_count} bunches</div>
                  <div className="text-xs text-slate-500">Coriander, Methi, Palak, Mint</div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl">
                  <Layers className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase">Total Sourcing SKUs</div>
                  <div className="text-2xl font-black text-white font-mono mt-0.5">{currentSummary.total_products_count} distinct items</div>
                  <div className="text-xs text-slate-500">Halol APMC Wholesale Procurement</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCT PROCUREMENT REQUIREMENT & SUPPLIER PLANNING */}
        {activeTab === 'products' && batchData && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing <strong>{batchData.products.length} products</strong> with 3% wholesale margin buffer.
              </span>
              <span className="text-emerald-400 font-semibold">
                Estimated Sourcing Budget: ₹{batchData.products.reduce((sum, p) => sum + Number(p.estimated_purchase_cost), 0).toFixed(2)}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800 tracking-wider">
                  <tr>
                    <th className="p-4">Vegetable / શાકભાજી</th>
                    <th className="p-4 text-center">Base Unit</th>
                    <th className="p-4 text-right">Customer Demand</th>
                    <th className="p-4 text-right text-emerald-400 font-bold">Suggested Mandi Purchase (+3%)</th>
                    <th className="p-4">Preferred Supplier</th>
                    <th className="p-4 text-right">Latest Mandi Rate</th>
                    <th className="p-4 text-right">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {batchData.products.map((prod) => (
                    <tr key={prod.procurement_item_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-sm text-white">{prod.product_name_gu}</div>
                        <div className="text-xs text-slate-400">{prod.product_name_en} • {prod.category_name_en}</div>
                        {prod.cancelled_after_lock_qty > 0 && (
                          <div className="text-[10px] text-amber-400 mt-0.5">
                            Cancelled post-lock: -{prod.cancelled_after_lock_qty} {prod.base_unit_code} (Adjusted: {prod.adjusted_operational_qty} {prod.base_unit_code})
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-300">
                        {prod.base_unit_code}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-300">
                        {prod.required_qty} {prod.base_unit_code}
                      </td>
                      <td className="p-4 text-right font-mono font-extrabold text-sm text-emerald-400 bg-emerald-950/20">
                        {prod.suggested_procurement_qty} {prod.base_unit_code}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{prod.preferred_supplier_name || 'Halol APMC Mandi'}</div>
                        <div className="text-[10px] text-slate-500">{prod.preferred_supplier_mandi || 'Open Market'}</div>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-300">
                        ₹{Number(prod.latest_mandi_rate).toFixed(2)}/{prod.base_unit_code}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-300">
                        ₹{Number(prod.estimated_purchase_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SUPPLIER PURCHASES ENTRY & WASTAGE */}
        {activeTab === 'purchasing' && batchData && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Record actual supplier purchase lines and receiving/wastage after sorting in the morning.</span>
              <span className="font-mono text-emerald-400 font-bold">
                Actual Mandi Spend: ₹{Number(currentSummary?.total_procurement_cost || 0).toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batchData.products.map((prod) => (
                <div key={prod.procurement_item_id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{prod.product_name_gu} ({prod.product_name_en})</h4>
                      <div className="text-xs text-slate-400">
                        Suggested: <span className="font-bold text-emerald-400">{prod.suggested_procurement_qty} {prod.base_unit_code}</span> | 
                        Procured: <span className="font-bold text-white">{prod.procured_qty} {prod.base_unit_code}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setActivePurchaseItem(prod);
                          setPurchaseForm({
                            supplier_name: prod.preferred_supplier_name || 'Patel Vegetable Traders',
                            purchased_qty: prod.suggested_procurement_qty.toString(),
                            rate_per_unit: prod.latest_mandi_rate.toString(),
                            bill_no: '',
                            notes: '',
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Purchase</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveReceivingItem(prod);
                          setReceivingForm({
                            received_qty: (prod.procured_qty || prod.suggested_procurement_qty).toString(),
                            usable_qty: (prod.procured_qty || prod.suggested_procurement_qty).toString(),
                            notes: '',
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Receiving</span>
                      </button>
                    </div>
                  </div>

                  {/* Purchase lines list */}
                  {prod.purchase_lines && prod.purchase_lines.length > 0 ? (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
                      {prod.purchase_lines.map((line) => (
                        <div key={line.id} className="p-2 rounded-xl bg-slate-950/60 flex items-center justify-between text-slate-300 font-mono">
                          <div>
                            <span className="font-bold text-white">{line.supplier_name}</span>
                            <span className="text-slate-500 text-[10px] ml-2">{line.mandi_lot_or_bill_no || 'Lot #'}</span>
                          </div>
                          <div>
                            {line.purchased_qty} {prod.base_unit_code} @ ₹{line.rate_per_unit} = <strong className="text-emerald-400">₹{line.total_cost}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">No purchase entries recorded yet.</div>
                  )}

                  {/* Receiving status */}
                  {prod.received_qty > 0 && (
                    <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-[11px] flex items-center justify-between text-emerald-300">
                      <span>Received: <strong>{prod.received_qty} {prod.base_unit_code}</strong> (Usable: {prod.usable_qty})</span>
                      <span>Wastage: <strong>{prod.wastage_qty} {prod.base_unit_code}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Purchase Entry Modal */}
            {activePurchaseItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                  <h3 className="text-lg font-bold text-white">
                    Record Purchase • {activePurchaseItem.product_name_gu} ({activePurchaseItem.product_name_en})
                  </h3>
                  <form onSubmit={handleSavePurchaseLine} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Mandi Supplier</label>
                      <input
                        type="text"
                        value={purchaseForm.supplier_name}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 font-bold block mb-1">Purchased Qty ({activePurchaseItem.base_unit_code})</label>
                        <input
                          type="number"
                          step="0.1"
                          value={purchaseForm.purchased_qty}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, purchased_qty: e.target.value })}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 font-bold block mb-1">Rate per {activePurchaseItem.base_unit_code} (₹)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={purchaseForm.rate_per_unit}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, rate_per_unit: e.target.value })}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Mandi Bill / Lot Number (Optional)</label>
                      <input
                        type="text"
                        value={purchaseForm.bill_no}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, bill_no: e.target.value })}
                        placeholder="e.g. APMC-LOT-4821"
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                      />
                    </div>

                    <div className="pt-2 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setActivePurchaseItem(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                      >
                        Save Purchase
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Receiving & Wastage Modal */}
            {activeReceivingItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                  <h3 className="text-lg font-bold text-white">
                    Morning Receiving & Wastage • {activeReceivingItem.product_name_gu}
                  </h3>
                  <form onSubmit={handleSaveReceiving} className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 font-bold block mb-1">Gross Received ({activeReceivingItem.base_unit_code})</label>
                        <input
                          type="number"
                          step="0.1"
                          value={receivingForm.received_qty}
                          onChange={(e) => setReceivingForm({ ...receivingForm, received_qty: e.target.value })}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 font-bold block mb-1">Usable after Sorting ({activeReceivingItem.base_unit_code})</label>
                        <input
                          type="number"
                          step="0.1"
                          value={receivingForm.usable_qty}
                          onChange={(e) => setReceivingForm({ ...receivingForm, usable_qty: e.target.value })}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setActiveReceivingItem(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                      >
                        Record Wastage
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FROZEN ORDERS MEMBERSHIP */}
        {activeTab === 'orders' && batchData && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>{batchData.orders.length} confirmed orders frozen into this procurement batch.</span>
              <span>All amounts are immutable historical snapshots.</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800 tracking-wider">
                  <tr>
                    <th className="p-4">Order Number</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Delivery Area</th>
                    <th className="p-4 text-center">Items</th>
                    <th className="p-4 text-right">Payable (COD)</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {batchData.orders.map((ord) => (
                    <tr key={ord.membership_id} className={`hover:bg-slate-800/40 transition-colors ${ord.is_cancelled_post_lock ? 'bg-red-950/20 text-red-300' : ''}`}>
                      <td className="p-4 font-mono font-bold text-white">
                        {ord.order_number}
                        {ord.is_manual_override && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-300 text-[10px] font-bold">
                            Override
                          </span>
                        )}
                        {ord.is_cancelled_post_lock && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-red-900 text-red-200 text-[10px] font-bold">
                            Cancelled Post-Lock
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-slate-300">{ord.customer_name || 'Customer'}</td>
                      <td className="p-4 text-slate-400">{ord.area_locality || 'Halol'}</td>
                      <td className="p-4 text-center font-mono">{ord.item_count} items</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-400">
                        ₹{Number(ord.final_payable_amount).toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                          {ord.order_status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PACKING PREPARATION SUMMARY */}
        {activeTab === 'packing' && batchData && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Packing station preparation queue for morning dispatch.</span>
              <span className="text-emerald-400 font-bold">{batchData.packing_queue.length} active bags to pack</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batchData.packing_queue.map((pack) => (
                <div key={pack.order_id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <div className="font-mono font-bold text-sm text-white">{pack.order_number}</div>
                      <div className="text-xs text-slate-400">{pack.customer_name} • {pack.area_locality}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400 font-mono">₹{Number(pack.final_payable_amount).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">Collect Cash</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {pack.items && pack.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300 font-mono">
                        <span>{item.product_name_gu} ({item.variant_name_gu || item.variant_name_en})</span>
                        <span className="font-bold text-white">× {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: WHATSAPP FORMATTER */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">1-Click WhatsApp / SMS Formatter for Owner & Staff</span>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
              >
                {copiedWhatsApp ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedWhatsApp ? 'Copied to Clipboard!' : 'Copy WhatsApp Report'}</span>
              </button>
            </div>

            <pre className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed shadow-inner">
              {generateWhatsAppReport()}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
