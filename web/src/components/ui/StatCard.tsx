import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  subtitle?: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    label?: string;
    isPositiveGood?: boolean;
  };
  subValues?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
  footerText?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  title,
  subtitle,
  value,
  icon: Icon,
  iconColor = 'text-emerald-500',
  trend,
  subValues,
  footerText,
  onClick,
  className = '',
}: StatCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs transition-all duration-200 ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 active:scale-99' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          {subtitle && (
            <span className="block text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {subtitle}
            </span>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight my-1">
        {value}
      </div>

      {subValues && subValues.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          {subValues.map((sub, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500">{sub.label}:</span>
              <span className={`font-bold ${sub.color || 'text-slate-700 dark:text-slate-300'}`}>
                {sub.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {trend && trend.value !== 0 && (
        <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold">
          {trend.value > 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +{trend.value.toFixed(1)}% {trend.label || 'vs prev'}
            </span>
          ) : (
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" /> {trend.value.toFixed(1)}% {trend.label || 'vs prev'}
            </span>
          )}
        </div>
      )}

      {footerText && (
        <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          {footerText}
        </div>
      )}
    </div>
  );
}
