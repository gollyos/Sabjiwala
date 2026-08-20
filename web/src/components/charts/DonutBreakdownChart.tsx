'use client';

import React, { useState, useMemo } from 'react';

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

  const validSegments = useMemo(() => segments.filter((s) => Number(s.value) > 0), [segments]);
  const total = useMemo(() => validSegments.reduce((acc, s) => acc + Number(s.value), 0), [validSegments]);

  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const renderedSegments = useMemo(() => {
    let currentOffset = 0;
    return validSegments.map((seg, idx) => {
      const percent = total > 0 ? (Number(seg.value) / total) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((currentOffset / 100) * circumference);
      currentOffset += percent;
      return {
        ...seg,
        idx,
        percent,
        strokeDasharray,
        strokeDashoffset,
        color: seg.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      };
    });
  }, [validSegments, total, circumference]);

  if (validSegments.length === 0 || total === 0) {
    return (
      <div className="h-64 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center p-6 text-slate-500 text-xs italic">
        No category breakdown available for this period.
      </div>
    );
  }

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
            {renderedSegments.map((seg) => {
              const isHovered = hoveredIdx === seg.idx;

              return (
                <circle
                  key={seg.id || seg.idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(seg.idx)}
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
          {renderedSegments.map((seg) => {
            const isHovered = hoveredIdx === seg.idx;

            return (
              <div
                key={seg.id || seg.idx}
                onMouseEnter={() => setHoveredIdx(seg.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  isHovered ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="truncate font-semibold">{seg.label}</span>
                </div>

                <div className="flex items-center space-x-2 font-mono shrink-0">
                  <span className="font-bold text-white">
                    {seg.formattedValue || `₹${Number(seg.value).toLocaleString('en-IN')}`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">({seg.percent.toFixed(1)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
