'use client';

import { getErrorMessage } from '@/lib/errors';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AdminNav } from '@/components/AdminNav';
import { todayIST } from '@/lib/istDate';
import {
  Calendar, Search, RefreshCw, Save, Star, IndianRupee,
  CheckCircle2, AlertCircle, TrendingUp, Package, Copy,
} from 'lucide-react';

interface VariantInfo {
  id: string;
  variant_name_en: string;
  variant_name_gu: string;
  multiplier_to_base_unit: number;
  selling_price: number;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
}

interface MandiRow {
  productId: string;
  nameEn: string;
  nameGu: string;
  imageUrl: string | null;
  categoryId: string;
  variants: VariantInfo[];
  originalDefaultId: string | null;
  /** Pack currently being edited / marked as best (draft until Save). */
  focusedVariantId: string;
  defaultDraftId: string;
  /** Draft selling prices keyed by variant id (only edited packs). */
  priceDrafts: Record<string, string>;
  /** Draft mandi purchase rate ₹/kg for the selected date. */
  mandiDraft: string;
  savedRate: number | null;
}

interface CategoryInfo {
  id: string;
  name_en: string;
}

const parsePrice = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = parseFloat(value);
  return isNaN(n) || n < 0 ? null : Math.round(n * 100) / 100;
};

export default function DailyMandiRatesPage() {
  const [supabase] = useState(() => createClient());
  const [selectedDate, setSelectedDate] = useState<string>(() => todayIST());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [rows, setRows] = useState<MandiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyingYesterday, setCopyingYesterday] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async (date: string) => {
    try {
      setLoading(true);
      setStatusMsg(null);

      const [catRes, prodRes, ratesRes] = await Promise.all([
        supabase.from('categories').select('id, name_en').eq('is_active', true).order('display_order'),
        supabase
          .from('products')
          .select(`
            id,
            name_en,
            name_gu,
            image_url,
            category_id,
            display_order,
            product_variants (
              id,
              variant_name_en,
              variant_name_gu,
              multiplier_to_base_unit,
              selling_price,
              is_default,
              is_active,
              display_order
            )
          `)
          .eq('is_active', true)
          .order('display_order'),
        // Non-fatal: if the daily-mandi-rates migration has not been applied
        // yet, still show the catalog and tell the owner what to run.
        supabase.rpc('get_daily_mandi_rates', { p_rate_date: date }),
      ]);

      if (catRes.data) setCategories(catRes.data as CategoryInfo[]);

      const rateMap = new Map<string, number>();
      if (ratesRes.data) {
        const rates = ratesRes.data as { product_id: string; purchase_rate_per_kg: number }[];
        (rates || []).forEach((r) => rateMap.set(r.product_id, Number(r.purchase_rate_per_kg)));
      } else if (ratesRes.error) {
        setStatusMsg({
          type: 'error',
          text: 'Mandi rate storage is not set up on the database yet. Apply docs/migrations/20260822000001_daily_mandi_rates_module.sql in Supabase, then reload. Selling prices and default packs still work.',
        });
      }

      const builtRows: MandiRow[] = ((prodRes.data || []) as {
        id: string; name_en: string; name_gu: string; image_url: string | null;
        category_id: string; product_variants: VariantInfo[];
      }[]).map((p) => {
        const variants = (p.product_variants || [])
          .filter((v) => v.is_active !== false)
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        const originalDefault = variants.find((v) => v.is_default) || variants[0] || null;
        return {
          productId: p.id,
          nameEn: p.name_en,
          nameGu: p.name_gu,
          imageUrl: p.image_url,
          categoryId: p.category_id,
          variants,
          originalDefaultId: originalDefault?.id || null,
          focusedVariantId: originalDefault?.id || '',
          defaultDraftId: originalDefault?.id || '',
          priceDrafts: {},
          mandiDraft: '',
          savedRate: rateMap.has(p.id) ? (rateMap.get(p.id) as number) : null,
        };
      }).filter((r) => r.variants.length > 0);

      // Pre-fill the mandi draft with the saved rate for quick editing.
      builtRows.forEach((r) => {
        if (r.savedRate !== null) r.mandiDraft = String(r.savedRate);
      });

      setRows(builtRows);
    } catch (err) {
      console.error('Error loading mandi rates screen:', err);
      setStatusMsg({ type: 'error', text: getErrorMessage(err) || 'Failed to load the catalog and saved rates.' });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData(selectedDate);
  }, [loadData, selectedDate]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== 'all' && r.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        r.nameEn.toLowerCase().includes(q) ||
        r.nameGu.includes(search.trim()) ||
        r.variants.some((v) => v.variant_name_en.toLowerCase().includes(q))
      );
    });
  }, [rows, search, categoryFilter]);

  const getEffectivePrice = (row: MandiRow, variantId: string): number => {
    const draft = parsePrice(row.priceDrafts[variantId] ?? '');
    if (draft !== null) return draft;
    return row.variants.find((v) => v.id === variantId)?.selling_price ?? 0;
  };

  const pendingMandi = useMemo(
    () => rows.filter((r) => {
      const parsed = parsePrice(r.mandiDraft);
      return parsed !== null && parsed !== r.savedRate;
    }),
    [rows]
  );

  const pendingPrices = useMemo(
    () => rows.flatMap((r) =>
      Object.entries(r.priceDrafts)
        .filter(([variantId, draft]) => {
          const parsed = parsePrice(draft);
          const original = r.variants.find((v) => v.id === variantId)?.selling_price;
          return parsed !== null && original !== undefined && parsed !== original;
        })
        .map(([variantId]) => ({ row: r, variantId }))
    ),
    [rows]
  );

  const pendingDefaults = useMemo(
    () => rows.filter((r) => r.defaultDraftId !== r.originalDefaultId),
    [rows]
  );

  const totalPending = pendingMandi.length + pendingPrices.length + pendingDefaults.length;

  const updateRow = (productId: string, updater: (row: MandiRow) => MandiRow) => {
    setRows((prev) => prev.map((r) => (r.productId === productId ? updater(r) : r)));
  };

  const handleCopyYesterday = async () => {
    // Pure calendar-date math — anchored at UTC midnight so no timezone shifts.
    const d = new Date(`${selectedDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const prevDate = d.toISOString().split('T')[0];

    setCopyingYesterday(true);
    try {
      const { data, error } = await supabase.rpc('get_daily_mandi_rates', { p_rate_date: prevDate });
      if (error) throw error;

      const prevRates = (data as { product_id: string; purchase_rate_per_kg: number }[]) || [];
      if (prevRates.length === 0) {
        setStatusMsg({ type: 'error', text: `No mandi rates were saved for ${prevDate}, so there is nothing to copy.` });
        return;
      }

      const prevMap = new Map(prevRates.map((r) => [r.product_id, Number(r.purchase_rate_per_kg)]));
      let filled = 0;
      const nextRows = rows.map((r) => {
        // Only fill items with no saved rate AND no manual entry for the
        // selected date — never overwrite today's work with yesterday's.
        if (r.savedRate === null && r.mandiDraft.trim() === '' && prevMap.has(r.productId)) {
          filled++;
          return { ...r, mandiDraft: String(prevMap.get(r.productId)) };
        }
        return r;
      });

      setRows(nextRows);
      setStatusMsg({
        type: 'success',
        text: filled > 0
          ? `Copied ${filled} rates from ${prevDate}. Review the amber rows and press Save.`
          : `Every item already has a rate for ${selectedDate} — nothing copied.`,
      });
    } catch (err) {
      console.error('Error copying yesterday rates:', err);
      setStatusMsg({ type: 'error', text: getErrorMessage(err) || "Failed to copy yesterday's rates." });
    } finally {
      setCopyingYesterday(false);
    }
  };

  const handleSave = async () => {
    if (totalPending === 0) return;
    setSaving(true);
    setStatusMsg(null);

    try {
      const parts: string[] = [];

      // 1. Date-wise mandi purchase rates
      if (pendingMandi.length > 0) {
        const payload = pendingMandi.map((r) => ({
          product_id: r.productId,
          purchase_rate_per_kg: parsePrice(r.mandiDraft),
        }));
        const { error } = await supabase.rpc('upsert_daily_mandi_rates', {
          p_rate_date: selectedDate,
          p_rates: payload,
        });
        if (error) throw error;
        parts.push(`${pendingMandi.length} mandi rates`);
      }

      // 2. Selling prices of edited packs (live on the storefront instantly)
      if (pendingPrices.length > 0) {
        const payload = pendingPrices.map(({ row, variantId }) => ({
          variant_id: variantId,
          selling_price: getEffectivePrice(row, variantId),
        }));
        const { error } = await supabase.rpc('bulk_update_variant_prices', {
          p_updates: payload,
          p_change_reason: `Mandi Rates screen — ${selectedDate}`,
        });
        if (error) throw error;
        parts.push(`${pendingPrices.length} selling prices`);
      }

      // 3. Best pack (gm/kg) shown to customers by default
      for (const row of pendingDefaults) {
        const { error } = await supabase.rpc('set_default_product_variant', {
          p_variant_id: row.defaultDraftId,
        });
        if (error) throw error;
      }
      if (pendingDefaults.length > 0) parts.push(`${pendingDefaults.length} default packs`);

      setStatusMsg({
        type: 'success',
        text: `Saved for ${selectedDate}: ${parts.join(', ')}. Storefront updated immediately.`,
      });
      await loadData(selectedDate);
    } catch (err) {
      console.error('Error saving mandi rates:', err);
      setStatusMsg({ type: 'error', text: getErrorMessage(err) || 'Failed to save. Please retry.' });
    } finally {
      setSaving(false);
    }
  };

  const savedCount = rows.filter((r) => r.savedRate !== null).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5 pb-16">
        {/* Header */}
        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              <IndianRupee className="w-4 h-4" />
              <span>Halol APMC Mandi · Date-wise Entry</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Daily Mandi &amp; Selling Rates (મંડી ખરીદ ભાવ અને વેચાણ ભાવ)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Select the date, enter that day&apos;s mandi purchase rate per kg for every item, set the customer
              selling price, and choose the best pack (gm/kg) customers see first — all on one screen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || todayIST())}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
                aria-label="Rate date"
              />
            </div>
            <button
              onClick={handleCopyYesterday}
              disabled={copyingYesterday || loading || saving}
              title="Copy the previous day's saved mandi rates into empty rows"
              className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {copyingYesterday ? 'Copying…' : 'Copy Yesterday'}
            </button>
            <button
              onClick={() => loadData(selectedDate)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </button>
            <button
              onClick={handleSave}
              disabled={saving || totalPending === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : `Save${totalPending > 0 ? ` (${totalPending})` : ''}`}
            </button>
          </div>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            {statusMsg.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Filters + summary */}
        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item (English / ગુજરાતી)…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              aria-label="Category filter"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name_en}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              {rows.length} items
            </span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
              {savedCount} mandi rates saved
            </span>
            <span className={`px-3 py-1.5 rounded-xl border ${
              totalPending > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {totalPending} pending changes
            </span>
          </div>
        </div>

        {/* Item list */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-xs font-bold text-slate-500">
            Loading catalog &amp; saved rates…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-xs font-bold text-slate-500">
            No items match this search / category.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredRows.map((row) => {
              const focused = row.variants.find((v) => v.id === row.focusedVariantId) || row.variants[0];
              const focusedPrice = getEffectivePrice(row, focused.id);
              const focusedOriginal = focused.selling_price;
              const priceModified = parsePrice(row.priceDrafts[focused.id] ?? '') !== null
                && focusedPrice !== focusedOriginal;
              const mandiParsed = parsePrice(row.mandiDraft);
              const mandiModified = mandiParsed !== null && mandiParsed !== row.savedRate;
              const defaultChanged = row.defaultDraftId !== row.originalDefaultId;
              const perKgPrice = focused.multiplier_to_base_unit > 0
                ? focusedPrice / focused.multiplier_to_base_unit
                : null;
              const marginPct = mandiParsed !== null && mandiParsed > 0 && perKgPrice !== null
                ? Math.round(((perKgPrice - mandiParsed) / mandiParsed) * 100)
                : null;

              return (
                <div
                  key={row.productId}
                  className={`bg-white border rounded-3xl shadow-xs p-4 grid grid-cols-1 lg:grid-cols-[minmax(200px,1.1fr)_minmax(260px,1.6fr)_130px_150px_110px] gap-4 items-center ${
                    mandiModified || priceModified || defaultChanged ? 'border-amber-300' : 'border-slate-200'
                  }`}
                >
                  {/* Item */}
                  <div className="flex items-center gap-3 min-w-0">
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.imageUrl}
                        alt={row.nameEn}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate">{row.nameEn}</div>
                      <div className="text-[11px] text-slate-500 truncate" lang="gu">{row.nameGu}</div>
                    </div>
                  </div>

                  {/* Packs: click to focus, star = site default */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.variants.map((v) => {
                      const isFocused = v.id === row.focusedVariantId;
                      const isDefault = v.id === row.defaultDraftId;
                      const price = getEffectivePrice(row, v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => updateRow(row.productId, (r) => ({ ...r, focusedVariantId: v.id }))}
                          title="Click to edit this pack's selling price"
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                            isFocused
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : isDefault
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {isDefault && <Star className="w-3 h-3 fill-current" />}
                          <span>{v.variant_name_en}</span>
                          <span className={isFocused ? 'text-emerald-100' : 'text-slate-400'}>₹{price}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => updateRow(row.productId, (r) => ({ ...r, defaultDraftId: r.focusedVariantId }))}
                      disabled={row.defaultDraftId === row.focusedVariantId}
                      title="Make the selected pack the one customers see first on the site"
                      className="px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer disabled:cursor-default flex items-center gap-1 bg-white text-amber-700 border-amber-300 hover:bg-amber-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200"
                    >
                      <Star className="w-3 h-3" />
                      Site Default
                    </button>
                  </div>

                  {/* Mandi purchase rate ₹/kg for the selected date */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Mandi ₹/kg
                    </label>
                    <input
                      inputMode="decimal"
                      value={row.mandiDraft}
                      onChange={(e) => updateRow(row.productId, (r) => ({ ...r, mandiDraft: e.target.value }))}
                      placeholder={row.savedRate !== null ? String(row.savedRate) : '—'}
                      className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold border focus:outline-none focus:ring-1 ${
                        mandiModified
                          ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-amber-400'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Selling price of the focused pack */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 truncate">
                      Sell ₹ · {focused.variant_name_en}
                    </label>
                    <input
                      inputMode="decimal"
                      value={row.priceDrafts[focused.id] ?? String(focusedOriginal)}
                      onChange={(e) => updateRow(row.productId, (r) => ({
                        ...r,
                        priceDrafts: { ...r.priceDrafts, [focused.id]: e.target.value },
                      }))}
                      className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold border focus:outline-none focus:ring-1 ${
                        priceModified
                          ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-amber-400'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Margin indicator */}
                  <div className="flex flex-col items-start lg:items-center gap-1">
                    {marginPct !== null ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black ${
                        marginPct >= 15
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : marginPct >= 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        <TrendingUp className="w-3 h-3" />
                        {marginPct >= 0 ? '+' : ''}{marginPct}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">Margin —</span>
                    )}
                    {defaultChanged && (
                      <span className="text-[10px] font-black text-amber-600">★ pack changed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
