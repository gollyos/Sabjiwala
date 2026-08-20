import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <BrandLogo size="lg" showGujarati={true} />
        </div>

        <div className="space-y-2">
          <span className="text-6xl font-black text-emerald-600 dark:text-emerald-400 font-mono">404</span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Page Not Found (પાનું મળ્યું નથી)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl shadow-md text-xs transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Fresh Store (હોમપેજ)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
