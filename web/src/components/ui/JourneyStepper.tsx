'use client';

import { Fragment, useEffect, useState } from 'react';
import { Sprout, ShoppingBasket, Truck, Home } from 'lucide-react';

const STEPS = [
  {
    icon: Sprout,
    labelGu: 'ખેતરેથી તાજું',
    labelEn: 'Fresh Picked',
    activeClasses: 'scale-110 border-emerald-300 bg-emerald-400/25 shadow-[0_0_20px_rgba(52,211,153,0.6)]',
    doneClasses: 'border-emerald-400/50 bg-emerald-400/10',
    activeIcon: 'text-emerald-100',
    doneIcon: 'text-emerald-300/80',
    activeLabel: 'text-emerald-200',
  },
  {
    icon: ShoppingBasket,
    labelGu: 'ટોકરીમાં પેક',
    labelEn: 'Packed in Tokri',
    activeClasses: 'scale-110 border-amber-300 bg-amber-400/25 shadow-[0_0_20px_rgba(251,191,36,0.6)]',
    doneClasses: 'border-amber-400/50 bg-amber-400/10',
    activeIcon: 'text-amber-100',
    doneIcon: 'text-amber-300/80',
    activeLabel: 'text-amber-200',
  },
  {
    icon: Truck,
    labelGu: 'ડિલિવરી પર',
    labelEn: 'Out for Delivery',
    activeClasses: 'scale-110 border-sky-300 bg-sky-400/25 shadow-[0_0_20px_rgba(56,189,248,0.6)]',
    doneClasses: 'border-sky-400/50 bg-sky-400/10',
    activeIcon: 'text-sky-100',
    doneIcon: 'text-sky-300/80',
    activeLabel: 'text-sky-200',
  },
  {
    icon: Home,
    labelGu: 'તમારા ઘરે',
    labelEn: 'At Your Door',
    activeClasses: 'scale-110 border-rose-300 bg-rose-400/25 shadow-[0_0_20px_rgba(251,113,133,0.6)]',
    doneClasses: 'border-rose-400/50 bg-rose-400/10',
    activeIcon: 'text-rose-100',
    doneIcon: 'text-rose-300/80',
    activeLabel: 'text-rose-200',
  },
];

interface JourneyStepperProps {
  intervalMs?: number;
  className?: string;
}

// Auto-looping visual: farm-fresh produce → basket → delivery → your door.
export function JourneyStepper({ intervalMs = 1500, className = '' }: JourneyStepperProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % STEPS.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return (
    <div className={`flex w-full items-start ${className}`} role="img" aria-label="Fresh produce journey: farm, packed in basket, out for delivery, at your door">
      {STEPS.map((step, idx) => {
        const isDone = idx < active;
        const isActive = idx === active;
        const Icon = step.icon;

        return (
          <Fragment key={step.labelEn}>
            <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-20">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-500 sm:h-14 sm:w-14 ${
                  isActive ? step.activeClasses : isDone ? step.doneClasses : 'border-white/20 bg-white/5'
                }`}
              >
                <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${isActive ? step.activeIcon : isDone ? step.doneIcon : 'text-white/50'}`} aria-hidden="true" />
              </div>
              <span lang="gu" className={`text-center text-[10px] font-bold leading-tight sm:text-xs ${isActive ? step.activeLabel : 'text-white/60'}`}>
                {step.labelGu}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="relative mt-6 h-1 flex-1 overflow-hidden rounded-full bg-white/15 sm:mt-7">
                <div className={`h-full bg-[#ffe1ad] transition-all duration-700 ${idx < active ? 'w-full' : 'w-0'}`} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
