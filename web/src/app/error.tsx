'use client';

import Link from 'next/link';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <BrandLogo size="lg" showGujarati={true} />
        </div>

        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Something Went Wrong (સમસ્યા આવી)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We encountered an unexpected error loading this page. Please try refreshing.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-400">Reference: {error.digest}</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl shadow-md text-xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
