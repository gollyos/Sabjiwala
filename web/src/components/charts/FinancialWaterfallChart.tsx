'use client';

import { TrendingUp } from 'lucide-react';
interface FinancialWaterfallProps {
  grossSales: number;
  first500Discount: number;
  codDiscount: number;
  netRevenue: number;
  procurementCost: number;
  wastageCost: number;
  grossContribution: number;
  marginPct?: number;
}

export default function FinancialWaterfallChart({
  grossSales,
  first500Discount,
  codDiscount,
  netRevenue,
  procurementCost,
  wastageCost,
  grossContribution,
  marginPct,
}: FinancialWaterfallProps) {
  const totalDiscounts = first500Discount + codDiscount;
  const calculatedMargin = marginPct !== undefined 
    ? marginPct 
    : netRevenue > 0 ? (grossContribution / netRevenue) * 100 : 0;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Sales & Gross Contribution Step-Down</span>
        </h3>
        <span className="text-xs font-mono font-bold text-emerald-400">
          Margin: {calculatedMargin.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {/* Step 1: Gross Sales */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            1. Gross Sales (GMV)
          </div>
          <div className="text-lg font-black text-white font-mono">
            ₹{Number(grossSales).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500">Cart product subtotal</div>
        </div>

        {/* Step 2: Discounts */}
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-600/30 space-y-1">
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
            2. Total Discounts (-)
          </div>
          <div className="text-lg font-black text-amber-300 font-mono">
            -₹{Number(totalDiscounts).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-400/70">
            FIRST500: ₹{Number(first500Discount).toFixed(0)} • COD: ₹{Number(codDiscount).toFixed(0)}
          </div>
        </div>

        {/* Step 3: Net Revenue */}
        <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-600/30 space-y-1">
          <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
            3. Net Customer Revenue
          </div>
          <div className="text-lg font-black text-blue-300 font-mono">
            ₹{Number(netRevenue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-blue-400/70">Authoritative net payable</div>
        </div>

        {/* Step 4: Costs (Procurement + Wastage) */}
        <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-600/30 space-y-1">
          <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
            4. Procurement & Wastage (-)
          </div>
          <div className="text-lg font-black text-red-300 font-mono">
            -₹{Number(procurementCost + wastageCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-red-400/70">
            Purchases: ₹{Number(procurementCost).toFixed(0)} • Wastage: ₹{Number(wastageCost).toFixed(0)}
          </div>
        </div>

        {/* Step 5: Gross Contribution */}
        <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-600/40 space-y-1">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>5. Gross Contribution</span>
          </div>
          <div className="text-lg font-black text-emerald-300 font-mono">
            ₹{Number(grossContribution).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-400/70">
            {calculatedMargin.toFixed(1)}% contribution margin
          </div>
        </div>
      </div>
    </div>
  );
}
