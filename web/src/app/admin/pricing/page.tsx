'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Product, ProductVariant, SellingPriceHistory } from '@/types/sabjiwala';
import { AdminNav } from '@/components/AdminNav';
import { 
  Tag, 
  Save, 
  History, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface PriceRow {
  variantId: string;
  productId: string;
  productNameEn: string;
  productNameGu: string;
  variantNameEn: string;
  variantNameGu: string;
  currentPrice: number;
  newPrice: number;
  isModified: boolean;
}

export default function DailyPricingPage() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [priceHistory, setPriceHistory] = useState<SellingPriceHistory[]>([]);
  const [reason, setReason] = useState('Daily Morning APMC Price Revision');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'daily_pricing' | 'history'>('daily_pricing');

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch Products with variants
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .order('display_order', { ascending: true });

      if (prodErr) throw prodErr;

      const prods = (prodData || []) as Product[];
      setProducts(prods);

      // Build initial price rows
      const rows: PriceRow[] = [];
      prods.forEach((p) => {
        (p.variants || []).forEach((v) => {
          rows.push({
            variantId: v.id,
            productId: p.id,
            productNameEn: p.name_en,
            productNameGu: p.name_gu,
            variantNameEn: v.variant_name_en,
            variantNameGu: v.variant_name_gu,
            currentPrice: Number(v.selling_price),
            newPrice: Number(v.selling_price),
            isModified: false,
          });
        });
      });
      setPriceRows(rows);

      // Fetch Recent Selling Price History
      const { data: histData } = await supabase
        .from('selling_price_history')
        .select('*')
        .order('effective_at', { ascending: false })
        .limit(25);

      if (histData) setPriceHistory(histData as SellingPriceHistory[]);
    } catch (err: any) {
      console.error('Error loading pricing data:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load catalog pricing.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  const handlePriceChange = (variantId: string, valStr: string) => {
    const val = parseFloat(valStr);
    const newPriceVal = isNaN(val) ? 0 : Math.max(0, val);

    setPriceRows((prev) =>
      prev.map((row) => {
        if (row.variantId === variantId) {
          return {
            ...row,
            newPrice: newPriceVal,
            isModified: newPriceVal !== row.currentPrice,
          };
        }
        return row;
      })
    );
  };

  const handleAdjustPrice = (variantId: string, delta: number) => {
    setPriceRows((prev) =>
      prev.map((row) => {
        if (row.variantId === variantId) {
          const adjusted = Math.max(0, row.newPrice + delta);
          return {
            ...row,
            newPrice: adjusted,
            isModified: adjusted !== row.currentPrice,
          };
        }
        return row;
      })
    );
  };

  const handleResetAll = () => {
    setPriceRows((prev) =>
      prev.map((row) => ({
        ...row,
        newPrice: row.currentPrice,
        isModified: false,
      }))
    );
  };

  const handleSaveBulkPrices = async (e: React.FormEvent) => {
    e.preventDefault();
    const modifiedRows = priceRows.filter((r) => r.isModified);
    if (modifiedRows.length === 0) {
      setStatusMsg({ type: 'error', text: 'No price modifications detected. Change prices to save.' });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    try {
      const payload = modifiedRows.map((r) => ({
        variant_id: r.variantId,
        selling_price: r.newPrice,
      }));

      const { data, error } = await supabase.rpc('bulk_update_variant_prices', {
        p_updates: payload,
        p_change_reason: reason.trim() || 'Daily Morning Price Revision',
      });

      if (error) throw error;

      setStatusMsg({
        type: 'success',
        text: `Successfully updated ${modifiedRows.length} variant prices and logged atomic price history!`,
      });

      // Reload fresh state
      await loadData();
    } catch (err: any) {
      console.error('Error saving prices:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update prices.' });
    } finally {
      setSaving(false);
    }
  };

  const modifiedCount = priceRows.filter((r) => r.isModified).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              <Tag className="w-4 h-4" />
              <span>Daily Halol APMC Price Controller</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Daily Selling Prices (શાકભાજીના રોજના ભાવ)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review and adjust daily consumer rates for Halol. Changes automatically write to immutable price history.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('daily_pricing')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'daily_pricing'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Price Editor ({priceRows.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Audit History ({priceHistory.length})</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div
            className={`mb-6 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-fadeIn ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                : 'bg-red-50 text-red-900 border border-red-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* TAB 1: DAILY PRICING TABLE */}
        {activeTab === 'daily_pricing' && (
          <form onSubmit={handleSaveBulkPrices} className="space-y-6">
            
            {/* Top Control Bar */}
            <div className="bg-emerald-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <label className="block text-xs font-bold text-emerald-200 mb-1">
                  Revision Reason / APMC Lot Note
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Halol APMC Morning Rate Adjustment"
                  className="w-full px-3.5 py-2 bg-emerald-950/60 border border-emerald-700/80 rounded-xl text-xs text-white placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="flex items-center space-x-3">
                {modifiedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-4 py-2.5 rounded-xl border border-white/20 text-white/80 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Changes</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving || modifiedCount === 0}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-extrabold text-sm rounded-2xl shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Publish {modifiedCount} Price Updates</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pricing Grid */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-4 px-6">Vegetable (શાકભાજી)</th>
                      <th className="py-4 px-6">Pack Variant</th>
                      <th className="py-4 px-6 text-right">Yesterday / Current</th>
                      <th className="py-4 px-6 text-center">Quick Adjust</th>
                      <th className="py-4 px-6 text-right">Today&apos;s New Rate (₹)</th>
                      <th className="py-4 px-6 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                          <span>Loading active vegetable variants...</span>
                        </td>
                      </tr>
                    ) : (
                      priceRows.map((row) => {
                        const diff = row.newPrice - row.currentPrice;
                        return (
                          <tr
                            key={row.variantId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              row.isModified ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <td className="py-4 px-6">
                              <div className="font-extrabold text-sm text-slate-900 leading-tight">
                                {row.productNameGu}
                              </div>
                              <div className="text-xs text-slate-500 font-medium">
                                {row.productNameEn}
                              </div>
                            </td>

                            <td className="py-4 px-6">
                              <span className="font-bold text-slate-800">
                                {row.variantNameGu || row.variantNameEn}
                              </span>
                            </td>

                            <td className="py-4 px-6 text-right font-mono font-bold text-slate-600">
                              ₹{row.currentPrice.toFixed(2)}
                            </td>

                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleAdjustPrice(row.variantId, -2)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
                                >
                                  -₹2
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustPrice(row.variantId, -1)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
                                >
                                  -₹1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustPrice(row.variantId, 1)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
                                >
                                  +₹1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustPrice(row.variantId, 2)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px]"
                                >
                                  +₹2
                                </button>
                              </div>
                            </td>

                            <td className="py-4 px-6 text-right">
                              <div className="inline-flex items-center space-x-1.5">
                                <span className="font-bold text-slate-400">₹</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={row.newPrice}
                                  onChange={(e) => handlePriceChange(row.variantId, e.target.value)}
                                  className={`w-24 px-3 py-2 text-right font-mono font-extrabold text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                    row.isModified
                                      ? 'border-amber-400 bg-amber-50 text-amber-950 font-black'
                                      : 'border-slate-200 bg-white text-slate-900'
                                  }`}
                                />
                              </div>
                            </td>

                            <td className="py-4 px-6 text-center">
                              {row.isModified ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                    diff > 0
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {diff > 0 ? (
                                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3 text-blue-600" />
                                  )}
                                  <span>
                                    {diff > 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  Current
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </form>
        )}

        {/* TAB 2: PRICE HISTORY AUDIT TRAIL */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">
                Selling Price Mutation History (ઓડિટ લોગ)
              </h3>
              <p className="text-xs text-slate-500">
                Append-only log of every price modification with exact timestamp and reason.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {priceHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No price history recorded yet.
                </div>
              ) : (
                priceHistory.map((hist) => (
                  <div key={hist.id} className="py-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        Variant #{hist.product_variant_id.slice(0, 8)}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Reason: {hist.change_reason || 'Manual revision'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-extrabold text-emerald-700 text-sm">
                        ₹{Number(hist.selling_price).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 justify-end">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(hist.effective_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
