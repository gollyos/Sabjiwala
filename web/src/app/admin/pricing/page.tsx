'use client';

import { getErrorMessage } from '@/lib/errors';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Product, SellingPriceHistory } from '@/types/sabjiwala';
import { AdminNav } from '@/components/AdminNav';
import { Tag, Save, History, CheckCircle2, AlertCircle, Plus, Minus, Search } from 'lucide-react';

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
  isFruit: boolean;
}

export default function DailyPricingPage() {
  const [supabase] = useState(() => createClient());
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [priceHistory, setPriceHistory] = useState<SellingPriceHistory[]>([]);
  const reason = 'Daily Morning APMC Price Revision';
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'vegetables' | 'fruits'>('all');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'daily_pricing' | 'history'>('daily_pricing');

  const loadData = useCallback(async () => {
    try {
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .order('display_order', { ascending: true });

      if (prodErr) throw prodErr;

      const prods = (prodData || []) as Product[];

      const rows: PriceRow[] = [];
      prods.forEach((p) => {
        const isFruit = (p.slug || '').includes('apple') || 
                        (p.slug || '').includes('banana') || 
                        (p.slug || '').includes('dadam') || 
                        (p.slug || '').includes('mosambi') || 
                        (p.slug || '').includes('orange') || 
                        (p.slug || '').includes('papaya') || 
                        (p.slug || '').includes('guava') || 
                        (p.slug || '').includes('watermelon') || 
                        (p.slug || '').includes('dragon') ||
                        (p.slug || '').includes('fruit');

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
            isFruit,
          });
        });
      });
      setPriceRows(rows);

      const { data: histData } = await supabase
        .from('selling_price_history')
        .select('*')
        .order('effective_at', { ascending: false })
        .limit(25);

      if (histData) setPriceHistory(histData as SellingPriceHistory[]);
    } catch (err) {
      console.error('Error loading pricing data:', err);
      setStatusMsg({ type: 'error', text: getErrorMessage(err) || 'Failed to load catalog pricing.' });
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

      const { error } = await supabase.rpc('bulk_update_variant_prices', {
        p_updates: payload,
        p_change_reason: reason.trim() || 'Daily Morning Price Revision',
      });

      if (error) throw error;

      setStatusMsg({
        type: 'success',
        text: `Successfully updated ${modifiedRows.length} variant prices!`,
      });

      await loadData();
    } catch (err) {
      console.error('Error saving prices:', err);
      setStatusMsg({ type: 'error', text: getErrorMessage(err) || 'Failed to update prices.' });
    } finally {
      setSaving(false);
    }
  };

  const modifiedCount = priceRows.filter((r) => r.isModified).length;
  const filteredRows = priceRows.filter((r) => {
    // 1. Module filter
    if (pricingFilter === 'fruits' && !r.isFruit) return false;
    if (pricingFilter === 'vegetables' && r.isFruit) return false;

    // 2. Search filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.productNameEn.toLowerCase().includes(q) || r.productNameGu.includes(q) || r.variantNameEn.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <Tag className="w-4 h-4" />
              <span>Daily Morning APMC Price Revision</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Daily Selling Prices (ફળો અને શાકભાજીના રોજના ભાવ)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Review and adjust daily consumer rates for Halol (Historical past orders remain locked & immutable).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('daily_pricing')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'daily_pricing'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Price Editor ({priceRows.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}>
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* TAB 1: DAILY PRICING TABLE */}
        {activeTab === 'daily_pricing' && (
          <form onSubmit={handleSaveBulkPrices} className="space-y-4">
            
            {/* Search & Bulk Actions Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              
              {/* Module Filter Chips */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setPricingFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    pricingFilter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  All ({priceRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPricingFilter('vegetables')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    pricingFilter === 'vegetables' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Vegetables ({priceRows.filter(r => !r.isFruit).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPricingFilter('fruits')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    pricingFilter === 'fruits' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Fruits ({priceRows.filter(r => r.isFruit).length})
                </button>
              </div>

              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search item name (સફરજન, ટામેટાં, કેળાં, બટાટા...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {modifiedCount > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Publish {modifiedCount} Changed Prices</span>
                  </button>
                </div>
              )}
            </div>

            {/* Pricing Rows Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.map((row) => {
                  const diff = row.newPrice - row.currentPrice;

                  return (
                    <div
                      key={row.variantId}
                      className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                        row.isModified ? 'bg-amber-50/40 dark:bg-amber-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {row.productNameGu} <span className="font-normal text-slate-500">({row.productNameEn})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Pack: {row.variantNameGu || row.variantNameEn}
                        </div>
                      </div>

                      {/* Current vs New Price Controls */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Current</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            ₹{row.currentPrice.toFixed(0)}
                          </span>
                        </div>

                        {/* +/- Buttons and Input */}
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleAdjustPrice(row.variantId, -1)}
                            className="w-7 h-7 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div className="flex items-center px-2">
                            <span className="text-slate-400 mr-0.5">₹</span>
                            <input
                              type="number"
                              value={row.newPrice}
                              onChange={(e) => handlePriceChange(row.variantId, e.target.value)}
                              className="w-14 text-center font-mono font-black text-slate-900 dark:text-white bg-transparent focus:outline-hidden"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAdjustPrice(row.variantId, 1)}
                            className="w-7 h-7 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Delta indicator */}
                        <div className="w-14 text-right font-mono font-bold text-[11px]">
                          {diff > 0 ? (
                            <span className="text-emerald-600">+₹{diff}</span>
                          ) : diff < 0 ? (
                            <span className="text-rose-600">-₹{Math.abs(diff)}</span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

          </form>
        )}

        {/* TAB 2: AUDIT HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              Immutable Price Revision Ledger
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {priceHistory.map((h) => (
                <div key={h.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      ₹{h.selling_price} {h.old_price && <span className="text-slate-400 line-through ml-1">₹{h.old_price}</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Reason: {h.change_reason || 'APMC Revision'}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    {new Date(h.effective_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
