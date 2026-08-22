'use client';

import { RefreshCw, ShoppingBag } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="gu">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 text-center font-sans antialiased">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xs space-y-6">
          <div className="text-3xl font-black text-emerald-600 tracking-tight">
            TaazaTokra (તાજાટોકરા)
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900">
              કંઈક સમસ્યા આવી છે (System Reload Required)
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              અમે એપ્લિકેશનને પુનઃપ્રારંભ કરવાની ભલામણ કરીએ છીએ.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-2xl shadow-xs text-xs transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application (રીલોડ કરો)</span>
            </button>

            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-slate-500" />
              <span>Go to Fresh Store</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
