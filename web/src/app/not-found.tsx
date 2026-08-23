import Link from 'next/link';
import { Home, Search, MessageCircle, ShoppingBag } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center bg-slate-50 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xs space-y-6">
        
        {/* Brand Header */}
        <div className="flex justify-center">
          <BrandLogo size="lg" showGujarati={true} />
        </div>

        {/* 404 Badge & Graphic */}
        <div className="space-y-3">
          <div className="inline-block px-4 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-black border border-emerald-200">
            ERROR 404
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            પેજ મળ્યું નથી (Page Not Found)
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            તમે જે પેજ શોધી રહ્યા છો તે અસ્તિત્વમાં નથી અથવા ખસેડવામાં આવ્યું છે.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-2xl shadow-xs text-xs transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>તાજી શાકભાજી ખરીદો (Home Store)</span>
          </Link>

          <Link
            href="/track"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span>ઓર્ડર ટ્રેક કરો (Track Order)</span>
          </Link>

          <a
            href="https://wa.me/917698186694?text=Halo%20Taji Tokri%20Support"
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
