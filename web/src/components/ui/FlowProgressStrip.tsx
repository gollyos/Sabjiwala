import Link from 'next/link';
import { Lock, CheckCircle2 } from 'lucide-react';

export interface FlowStep {
  label: string;
  labelGu?: string;
  countText: string;
  subText?: string;
  status: 'pending' | 'active' | 'completed' | 'locked';
  href?: string;
}

interface FlowProgressStripProps {
  ordersCount: number;
  procurementLocked: boolean;
  packingPacked: number;
  packingTotal: number;
  deliveryOut: number;
  deliveryDelivered: number;
  totalOrders: number;
  className?: string;
}

export function FlowProgressStrip({
  ordersCount,
  procurementLocked,
  packingPacked,
  packingTotal,
  deliveryOut,
  deliveryDelivered,
  totalOrders,
  className = '',
}: FlowProgressStripProps) {
  const steps: FlowStep[] = [
    {
      label: 'Orders',
      labelGu: 'ઓર્ડર્સ',
      countText: `${ordersCount}`,
      subText: 'Total placed',
      status: ordersCount > 0 ? 'completed' : 'pending',
      href: '/admin/orders',
    },
    {
      label: 'Procurement',
      labelGu: 'ખરીદી',
      countText: procurementLocked ? 'Locked' : 'Open',
      subText: procurementLocked ? '8 PM Cutoff' : 'Pending Lock',
      status: procurementLocked ? 'locked' : 'active',
      href: '/admin/procurement',
    },
    {
      label: 'Packing',
      labelGu: 'પેકિંગ',
      countText: `${packingPacked} / ${packingTotal || ordersCount}`,
      subText: packingPacked === (packingTotal || ordersCount) && ordersCount > 0 ? 'All Packed' : 'In Godown',
      status: packingPacked === (packingTotal || ordersCount) && ordersCount > 0 ? 'completed' : 'active',
      href: '/admin/packing',
    },
    {
      label: 'Delivery',
      labelGu: 'ડિલિવરી',
      countText: `${deliveryOut} / ${totalOrders || ordersCount}`,
      subText: 'Out on Route',
      status: deliveryOut > 0 ? 'active' : 'pending',
      href: '/admin/delivery',
    },
    {
      label: 'Delivered',
      labelGu: 'સફળ ડિલિવરી',
      countText: `${deliveryDelivered}`,
      subText: deliveryDelivered === ordersCount && ordersCount > 0 ? '100% Done' : 'Completed',
      status: deliveryDelivered === ordersCount && ordersCount > 0 ? 'completed' : 'active',
      href: '/admin/delivery',
    },
  ];

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs ${className}`}>
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Today&apos;s Operational Flow (આજની કામગીરી)</span>
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">Live pipeline</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {steps.map((step, idx) => {
          const isLocked = step.status === 'locked';
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'active';

          const content = (
            <div
              className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-full relative overflow-hidden ${
                isCompleted
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
                  : isLocked
                  ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/80 text-purple-950 dark:text-purple-100'
                  : isActive
                  ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-100'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              } hover:shadow-xs`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="truncate">
                  {step.label} {step.labelGu && <span className="opacity-75 font-normal">({step.labelGu})</span>}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono opacity-60">#{idx + 1}</span>
                )}
              </div>

              <div className="my-1.5">
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                  {step.countText}
                </div>
                {step.subText && (
                  <div className="text-[10px] opacity-75 font-medium truncate">
                    {step.subText}
                  </div>
                )}
              </div>
            </div>
          );

          if (step.href) {
            return (
              <Link key={idx} href={step.href} className="block group cursor-pointer">
                {content}
              </Link>
            );
          }

          return <div key={idx}>{content}</div>;
        })}
      </div>
    </div>
  );
}
