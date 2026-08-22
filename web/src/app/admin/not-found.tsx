import Link from 'next/link';
import { LayoutDashboard, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function AdminNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans text-slate-900">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xs space-y-6">
        
        <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto border border-slate-200">
          <ShieldAlert className="w-8 h-8 text-emerald-600" />
        </div>

        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
            ADMIN 404
          </div>
          <h1 className="text-xl font-black text-slate-900">
            Admin Page Not Found (એડમિન પેજ મળ્યું નથી)
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            The requested operations screen does not exist or you may not have permission to view it.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <Link
            href="/admin/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-2xl shadow-xs text-xs transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Admin HQ Dashboard (મુખ્ય ડેશબોર્ડ)</span>
          </Link>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Storefront</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
