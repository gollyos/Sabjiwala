'use client';

import { useState } from 'react';

export interface BarItem {
  id: string;
  name_en: string;
  name_gu: string;
  base_unit?: string;
  total_quantity?: number;
  total_revenue?: number;
  gross_contribution?: number;
  orders_count?: number;
  [key: string]: unknown;
}

interface HorizontalBarChartProps {
  items: BarItem[];
  title?: string;
  onItemClick?: (item: BarItem) => void;
}

type MetricType = 'revenue' | 'quantity' | 'contribution' | 'orders';

export default function HorizontalBarChart({
  items,
  title = 'Top Products',
  onItemClick,
}: HorizontalBarChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>('revenue');

  if (!items || items.length === 0) {
    return (
      <div className="h-64 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center p-6 text-slate-500 text-xs italic">
        No product data available for this period.
      </div>
    );
  }

  // Get active value for each item
  const getValue = (item: BarItem): number => {
    switch (activeMetric) {
      case 'quantity':
        return Number(item.total_quantity || 0);
      case 'contribution':
        return Number(item.gross_contribution || 0);
      case 'orders':
        return Number(item.orders_count || 0);
      case 'revenue':
      default:
        return Number(item.total_revenue || 0);
    }
  };

  const formatValue = (item: BarItem, val: number): string => {
    switch (activeMetric) {
      case 'quantity':
        return `${val.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${item.base_unit || ''}`;
      case 'orders':
        return `${val} orders`;
      case 'contribution':
      case 'revenue':
      default:
        return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    }
  };

  const sortedItems = [...items].sort((a, b) => getValue(b) - getValue(a)).slice(0, 8);
  const maxVal = Math.max(...sortedItems.map(getValue), 1);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Header with Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>{title}</span>
        </h3>

        {/* Metric Selector Pills */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setActiveMetric('revenue')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMetric === 'revenue' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Revenue
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('quantity')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMetric === 'quantity' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Quantity
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('contribution')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMetric === 'contribution' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Contribution
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('orders')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMetric === 'orders' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Orders
          </button>
        </div>
      </div>

      {/* Bars List */}
      <div className="space-y-3 pt-1">
        {sortedItems.map((item, idx) => {
          const val = getValue(item);
          const pct = Math.max(Math.min((val / maxVal) * 100, 100), 2);

          return (
            <div
              key={item.id || idx}
              onClick={() => onItemClick?.(item)}
              className={`group p-2.5 rounded-2xl transition-all ${
                onItemClick ? 'cursor-pointer hover:bg-slate-800/60' : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center space-x-2 font-bold text-white">
                  <span className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{item.name_en}</span>
                  <span className="text-slate-400 text-[11px] font-normal truncate">({item.name_gu})</span>
                </div>

                <div className="font-mono font-extrabold text-emerald-400 text-xs">
                  {formatValue(item, val)}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                <div
                  className="h-full bg-linear-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
