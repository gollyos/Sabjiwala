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
    <div className={`bg-white border border-slate-200 rounded-3xl p-6 shadow-xs ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Today&apos;s Operational Flow (આજની કામગીરી)</span>
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">Live pipeline</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {steps.map((step, idx) => {
          const isLocked = step.status === 'locked';
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'active';

          const content = (
            <div
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-full relative overflow-hidden ${
                isCompleted
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : isLocked
                  ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                  : isActive
                  ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              } hover:shadow-xs`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="truncate">
                  {step.label} {step.labelGu && <span className="opacity-75 font-normal">({step.labelGu})</span>}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isLocked ? (
                  <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono opacity-60">#{idx + 1}</span>
                )}
              </div>

              <div className="my-2">
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900">
                  {step.countText}
                </div>
                {step.subText && (
                  <div className="text-[10px] text-slate-500 font-medium truncate">
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
