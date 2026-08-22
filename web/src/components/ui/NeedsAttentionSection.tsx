import Link from 'next/link';
import { ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';

export interface AttentionItem {
  id?: string;
  type?: 'packing' | 'delivery' | 'cash' | 'stock' | string;
  title: string;
  titleGu?: string;
  subtitle?: string;
  count?: number | string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  href?: string;
}

interface NeedsAttentionSectionProps {
  items: AttentionItem[];
  className?: string;
}

export function NeedsAttentionSection({ items = [], className = '' }: NeedsAttentionSectionProps) {
  const hasIssues = items && items.length > 0;

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl p-6 shadow-xs ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-xl ${hasIssues ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {hasIssues ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
            Needs Attention (ધ્યાન આપવાની જરૂર છે)
          </h3>
          {hasIssues && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 font-mono">
              {items.length} {items.length === 1 ? 'issue' : 'issues'}
            </span>
          )}
        </div>

        <span className="text-[11px] font-mono uppercase text-slate-400">
          Exceptions
        </span>
      </div>

      {!hasIssues ? (
        <div className="py-4 px-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-950">
                All good. No urgent issues. (બધું બરાબર છે)
              </div>
              <div className="text-[11px] text-emerald-800">
                No packing problems, delivery failures, or COD cash discrepancies detected.
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">🎉 OK</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {items.map((item, idx) => {
            const isHigh = item.severity === 'high' || item.severity === 'critical';

            const itemContent = (
              <div
                className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 group cursor-pointer ${
                  isHigh
                    ? 'bg-rose-50 border-rose-200 hover:bg-rose-100 hover:border-rose-300 text-rose-950'
                    : 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300 text-amber-950'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs tracking-tight truncate">
                      {item.title}
                    </span>
                  </div>
                  {item.subtitle && (
                    <div className="text-[11px] opacity-80 truncate font-medium mt-0.5">
                      {item.subtitle}
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.id || idx} href={item.href} className="block">
                  {itemContent}
                </Link>
              );
            }

            return <div key={item.id || idx}>{itemContent}</div>;
          })}
        </div>
      )}
    </div>
  );
}
