import React from 'react';
import Link from 'next/link';

interface BrandLogoProps {
  className?: string;
  showTagline?: boolean;
  showGujarati?: boolean;
  size?: 'sm' | 'md' | 'lg';
  asLink?: boolean;
  href?: string;
}

export function BrandLogo({
  className = '',
  showTagline = false,
  showGujarati = false,
  size = 'md',
  asLink = true,
  href = '/',
}: BrandLogoProps) {
  const sizeClasses = {
    sm: {
      icon: 'w-6 h-6 text-sm',
      title: 'text-base font-black',
      tagline: 'text-[9px]',
      gu: 'text-[10px]',
    },
    md: {
      icon: 'w-8 h-8 text-base',
      title: 'text-lg sm:text-xl font-black',
      tagline: 'text-[10px] sm:text-xs',
      gu: 'text-xs',
    },
    lg: {
      icon: 'w-11 h-11 text-xl',
      title: 'text-2xl sm:text-3xl font-black',
      tagline: 'text-xs sm:text-sm',
      gu: 'text-sm font-semibold',
    },
  };

  const currentSize = sizeClasses[size];

  const content = (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Visual Token / Tokra Icon */}
      <div className={`${currentSize.icon} rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 font-black`}>
        <span>🌿</span>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col leading-tight">
        <div className="flex items-baseline gap-1.5">
          <span className={`${currentSize.title} tracking-tight text-slate-900 dark:text-white font-sans`}>
            Taaza<span className="text-emerald-600 dark:text-emerald-400">Tokra</span>
          </span>
          {showGujarati && (
            <span className={`${currentSize.gu} text-emerald-700 dark:text-emerald-300 font-medium font-sans opacity-90`}>
              તાજાટોકરા
            </span>
          )}
        </div>
        {showTagline && (
          <span className={`${currentSize.tagline} text-slate-500 dark:text-slate-400 font-medium tracking-normal`}>
            Taaza Phal, Taazi Sabzi — Seedha Ghar Tak.
          </span>
        )}
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link href={href} className="inline-block transition-transform hover:scale-[1.01] active:scale-95 focus:outline-hidden">
        {content}
      </Link>
    );
  }

  return content;
}

export default BrandLogo;
