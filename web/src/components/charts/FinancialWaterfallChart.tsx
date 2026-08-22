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
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Sales & Gross Contribution Step-Down</span>
        </h3>
        <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          Margin: {calculatedMargin.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {/* Step 1: Gross Sales */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            1. Gross Sales (GMV)
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">
            ₹{Number(grossSales).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400">Cart product subtotal</div>
        </div>

        {/* Step 2: Discounts */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
          <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
            2. Total Discounts (-)
          </div>
          <div className="text-lg font-black text-amber-800 font-mono">
            -₹{Number(totalDiscounts).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-700">
            FIRST500: ₹{Number(first500Discount).toFixed(0)} • COD: ₹{Number(codDiscount).toFixed(0)}
          </div>
        </div>

        {/* Step 3: Net Revenue */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1">
          <div className="text-[10px] text-blue-800 font-bold uppercase tracking-wider">
            3. Net Customer Revenue
          </div>
          <div className="text-lg font-black text-blue-900 font-mono">
            ₹{Number(netRevenue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-blue-700">Authoritative net payable</div>
        </div>

        {/* Step 4: Costs (Procurement + Wastage) */}
        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-1">
          <div className="text-[10px] text-rose-800 font-bold uppercase tracking-wider">
            4. Procurement & Wastage (-)
          </div>
          <div className="text-lg font-black text-rose-800 font-mono">
            -₹{Number(procurementCost + wastageCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-rose-700">
            Purchases: ₹{Number(procurementCost).toFixed(0)} • Wastage: ₹{Number(wastageCost).toFixed(0)}
          </div>
        </div>

        {/* Step 5: Gross Contribution */}
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
          <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <span>5. Gross Contribution</span>
          </div>
          <div className="text-lg font-black text-emerald-800 font-mono">
            ₹{Number(grossContribution).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-700">
            Realized Net Margin (નફો)
          </div>
        </div>
      </div>
    </div>
  );
}
