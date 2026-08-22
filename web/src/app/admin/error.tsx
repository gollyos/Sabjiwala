'use client';

import Link from 'next/link';
import { RefreshCw, LayoutDashboard, AlertCircle } from 'lucide-react';

export default function AdminErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans text-slate-900">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xs space-y-6">
        
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900">
            Operation Error (કામગીરીમાં સમસ્યા આવી)
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Could not complete this operational action. Please reload or check your connection.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-2xl shadow-xs text-xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Operation (ફરી પ્રયાસ કરો)</span>
          </button>

          <Link
            href="/admin/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4 text-slate-500" />
            <span>Admin HQ Dashboard</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
