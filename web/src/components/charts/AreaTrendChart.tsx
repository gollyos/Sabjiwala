'use client';

import React, { useState } from 'react';

export interface AreaDataPoint {
  date: string;
  label: string;
  gross_sales?: number;
  net_sales: number;
  discounts?: number;
  total_orders?: number;
  [key: string]: unknown;
}

interface AreaTrendChartProps {
  data: AreaDataPoint[];
  metricKey?: 'net_sales' | 'gross_sales' | 'total_orders';
  title?: string;
  onPointClick?: (point: AreaDataPoint) => void;
}

export default function AreaTrendChart({
  data,
  metricKey = 'net_sales',
  title = 'Sales Trend',
  onPointClick,
}: AreaTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col items-center justify-center p-6 text-slate-500 text-xs italic">
        No trend data available for this selected date range.
      </div>
    );
  }

  const values = data.map((d) => Number(d[metricKey] || 0));
  const maxValue = Math.max(...values, 1);
  const minValue = 0;

  const width = 800;
  const height = 260;
  const paddingX = 45;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartW = width - paddingX * 2;
  const chartH = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingX + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const val = Number(d[metricKey] || 0);
    const y = paddingTop + chartH - (val / maxValue) * chartH;
    return { x, y, data: d, val };
  });

  const pathD =
    points.length === 1
      ? `M ${points[0].x - 30} ${points[0].y} L ${points[0].x + 30} ${points[0].y}`
      : points.reduce((acc, curr, idx) => {
          if (idx === 0) return `M ${curr.x} ${curr.y}`;
          const prev = points[idx - 1];
          const cx = (prev.x + curr.x) / 2;
          return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
        }, '');

  const areaD =
    points.length === 1
      ? `M ${points[0].x - 30} ${height - paddingBottom} L ${points[0].x - 30} ${points[0].y} L ${points[0].x + 30} ${points[0].y} L ${points[0].x + 30} ${height - paddingBottom} Z`
      : `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>{title}</span>
        </h3>
        <span className="text-[11px] font-mono text-slate-400">
          Peak: {metricKey === 'total_orders' ? `${maxValue} orders` : `₹${maxValue.toLocaleString('en-IN')}`}
        </span>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + chartH * (1 - ratio);
            const labelVal = Math.round(ratio * maxValue);
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[10px]"
                >
                  {metricKey === 'total_orders' ? labelVal : `₹${labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : labelVal}`}
                </text>
              </g>
            );
          })}

          {/* Fill Area */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Points & Hover Interactivity */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onPointClick?.(pt.data)}
              >
                {/* Invisible hover target */}
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                {/* Visible dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4}
                  fill="#10b981"
                  stroke="#0f172a"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150"
                />

                {/* X-Axis Labels */}
                {(data.length <= 10 || idx % Math.ceil(data.length / 8) === 0 || idx === data.length - 1) && (
                  <text
                    x={pt.x}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-slate-400 font-mono text-[10px]"
                  >
                    {pt.data.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Box */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-950/95 border border-emerald-500/60 p-3 rounded-2xl shadow-2xl backdrop-blur-md text-xs space-y-1"
            style={{
              left: `${(points[hoveredIndex].x / width) * 100}%`,
              top: `${(points[hoveredIndex].y / height) * 100}%`,
            }}
          >
            <div className="font-bold text-white border-b border-slate-800 pb-1">
              {points[hoveredIndex].data.label}
            </div>
            <div className="text-emerald-400 font-mono font-black text-sm">
              {metricKey === 'total_orders'
                ? `${points[hoveredIndex].val} Orders`
                : `₹${points[hoveredIndex].val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </div>
            {points[hoveredIndex].data.gross_sales !== undefined && (
              <div className="text-[10px] text-slate-400 font-mono">
                Gross: ₹{Number(points[hoveredIndex].data.gross_sales).toFixed(2)}
              </div>
            )}
            {points[hoveredIndex].data.discounts !== undefined && Number(points[hoveredIndex].data.discounts) > 0 && (
              <div className="text-[10px] text-amber-400 font-mono">
                Discounts: -₹{Number(points[hoveredIndex].data.discounts).toFixed(2)}
              </div>
            )}
            {onPointClick && (
              <div className="text-[9px] text-slate-400 font-semibold pt-1">
                Click to inspect orders →
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
