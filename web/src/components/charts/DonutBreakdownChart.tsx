'use client';

import React, { useState } from 'react';

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color?: string;
  formattedValue?: string;
}

interface DonutBreakdownChartProps {
  segments: DonutSegment[];
  title?: string;
  centerLabel?: string;
  centerValue?: string;
}

const DEFAULT_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#64748b', // slate
];

export default function DonutBreakdownChart({
  segments,
  title = 'Breakdown',
  centerLabel = 'Total',
  centerValue,
}: DonutBreakdownChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const validSegments = segments.filter((s) => Number(s.value) > 0);
  const total = validSegments.reduce((acc, s) => acc + Number(s.value), 0);

  if (validSegments.length === 0 || total === 0) {
    return (
      <div className="h-64 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center p-6 text-slate-500 text-xs italic">
        No category breakdown available for this period.
      </div>
    );
  }

  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
        <span>{title}</span>
      </h3>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            {validSegments.map((seg, idx) => {
              const percent = (Number(seg.value) / total) * 100;
              const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += percent;

              const color = seg.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={seg.id || idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {hoveredIdx !== null ? validSegments[hoveredIdx].label : centerLabel}
            </span>
            <span className="text-sm font-black font-mono text-white">
              {hoveredIdx !== null
                ? (validSegments[hoveredIdx].formattedValue || `₹${Number(validSegments[hoveredIdx].value).toLocaleString('en-IN')}`)
                : (centerValue || `₹${total.toLocaleString('en-IN')}`)}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full space-y-2 text-xs">
          {validSegments.map((seg, idx) => {
            const color = seg.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            const pct = ((Number(seg.value) / total) * 100).toFixed(1);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={seg.id || idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  isHovered ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: color }} />
                  <span className="truncate font-semibold">{seg.label}</span>
                </div>

                <div className="flex items-center space-x-2 font-mono shrink-0">
                  <span className="font-bold text-white">
                    {seg.formattedValue || `₹${Number(seg.value).toLocaleString('en-IN')}`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
