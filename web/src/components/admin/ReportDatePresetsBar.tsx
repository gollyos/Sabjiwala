'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { toISTDate, toISTDateString } from '@/lib/istDate';

export type DatePresetType = 'today' | 'tomorrow' | 'this_week' | 'this_month' | '30days' | 'custom';

export function computePresetDates(preset: DatePresetType): { startDate: string; endDate: string } {
  // All calendar math runs on the IST-shifted date so presets match India's
  // day boundaries instead of the browser/server timezone.
  const now = toISTDate();
  const format = (d: Date) => toISTDateString(d);

  if (preset === 'today') {
    const today = format(now);
    return { startDate: today, endDate: today };
  } else if (preset === 'tomorrow') {
    const tomStr = format(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    return { startDate: tomStr, endDate: tomStr };
  } else if (preset === 'this_week') {
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getTime());
    monday.setUTCDate(diff);
    return { startDate: format(monday), endDate: format(now) };
  } else if (preset === 'this_month') {
    const firstDay = new Date(now.getTime());
    firstDay.setUTCDate(1);
    return { startDate: format(firstDay), endDate: format(now) };
  } else if (preset === '30days') {
    const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { startDate: format(past), endDate: format(now) };
  }
  return { startDate: format(now), endDate: format(now) };
}


interface ReportDatePresetsBarProps {
  startDate: string;
  endDate: string;
  activePreset: DatePresetType;
  onPresetChange: (preset: DatePresetType) => void;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
}

export function ReportDatePresetsBar({
  startDate,
  endDate,
  activePreset,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
}: ReportDatePresetsBarProps) {
  const presets: { id: DatePresetType; labelEn: string; labelGu: string }[] = [
    { id: 'today', labelEn: 'Today', labelGu: 'આજે' },
    { id: 'tomorrow', labelEn: 'Tomorrow', labelGu: 'આવતીકાલે' },
    { id: 'this_week', labelEn: 'This Week', labelGu: 'આ અઠવાડિયે' },
    { id: 'this_month', labelEn: 'This Month', labelGu: 'આ મહિને' },
    { id: '30days', labelEn: 'Last 30 Days', labelGu: '૩૦ દિવસ' },
  ];

  return (
    <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs font-sans">
      {/* Quick Presets Group */}
      <div className="flex flex-wrap items-center bg-slate-100/90 p-1.5 rounded-2xl gap-1 font-bold">
        {presets.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPresetChange(p.id)}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                isActive
                  ? 'bg-white text-emerald-800 font-black shadow-xs ring-1 ring-emerald-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold'
              }`}
            >
              {isActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block shadow-2xs" />
              )}
              <span>{p.labelEn}</span>
              <span className={`text-[10px] ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                ({p.labelGu})
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom Date Pickers */}
      <div className="flex items-center gap-3">
        <div className="flex items-center space-x-2">
          <label className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>From:</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-slate-500 font-bold uppercase text-[10px]">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}
