'use client';

import Link from 'next/link';
import { RefreshCw, ShoppingBag, MessageCircle, AlertCircle } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xs space-y-6">
        
        <div className="flex justify-center">
          <BrandLogo size="lg" showGujarati={true} />
        </div>

        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900">
            કંઈક સમસ્યા આવી છે (Something Went Wrong)
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            અમે આ પેજ લોડ કરવામાં અણધારી સમસ્યાનો સામનો કર્યો છે. કૃપા કરીને ફરી પ્રયાસ કરો અથવા હોમપેજ પર પાછા જાઓ.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-2xl shadow-xs text-xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>ફરી પ્રયાસ કરો (Try Again)</span>
          </button>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-slate-500" />
            <span>હોમપેજ પર જાઓ (Fresh Store)</span>
          </Link>

          <a
            href="https://wa.me/919974283542?text=Halo%20Taji Tokri%20Support"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-2xl text-xs transition-all cursor-pointer border border-emerald-200"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp સહાય (Help Desk)</span>
          </a>
        </div>

      </div>
    </div>
  );
}

