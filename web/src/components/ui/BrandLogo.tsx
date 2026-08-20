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
      icon: 'w-7 h-7 text-xs',
      svg: 'w-4 h-4',
      title: 'text-base font-black',
      tagline: 'text-[9px]',
      gu: 'text-[10px] px-1.5 py-0.2',
    },
    md: {
      icon: 'w-9 h-9 text-sm',
      svg: 'w-5 h-5',
      title: 'text-lg sm:text-xl font-black',
      tagline: 'text-[10px] sm:text-xs',
      gu: 'text-xs px-2 py-0.5',
    },
    lg: {
      icon: 'w-12 h-12 text-base',
      svg: 'w-7 h-7',
      title: 'text-2xl sm:text-3xl font-black',
      tagline: 'text-xs sm:text-sm',
      gu: 'text-sm px-2.5 py-1',
    },
  };

  const currentSize = sizeClasses[size];

  const content = (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon Badge with Vector Tokra Leaf */}
      <div className={`${currentSize.icon} rounded-2xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-700/25 shrink-0 border border-emerald-400/30`}>
        <svg className={`${currentSize.svg} text-white`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L9.5 7.5L4 8L8 12.5L7 18L12 15L17 18L16 12.5L20 8L14.5 7.5L12 2Z" fill="rgba(255,255,255,0.2)" />
          <path d="M11 20A7 7 0 0 1 4 13C4 7 11 3 11 3S18 7 18 13A7 7 0 0 1 11 20Z" fill="currentColor" opacity="0.9" />
          <path d="M11 9V17" stroke="#047857" strokeWidth="2" />
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-2">
          <div className={`${currentSize.title} tracking-tight font-sans flex items-center`}>
            <span className="text-slate-900 dark:text-white font-black">Taaza</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">Tokra</span>
          </div>
          {showGujarati && (
            <span className={`${currentSize.gu} rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold border border-emerald-200/80 dark:border-emerald-800/80 tracking-normal`}>
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
      <Link href={href} className="inline-block transition-transform hover:scale-[1.01] active:scale-98 focus:outline-hidden">
        {content}
      </Link>
    );
  }

  return content;
}

export default BrandLogo;
