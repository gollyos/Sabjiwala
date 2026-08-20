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
      icon: 'w-6 h-6 text-xs',
      svg: 'w-3.5 h-3.5',
      title: 'text-sm font-black',
      tagline: 'text-[9px]',
      gu: 'text-[9px] px-1 py-0.2',
    },
    md: {
      icon: 'w-8 h-8 text-sm',
      svg: 'w-4.5 h-4.5',
      title: 'text-base sm:text-lg font-black',
      tagline: 'text-[10px] sm:text-xs',
      gu: 'text-[10px] sm:text-xs px-1.5 py-0.5',
    },
    lg: {
      icon: 'w-11 h-11 text-base',
      svg: 'w-6 h-6',
      title: 'text-xl sm:text-2xl font-black',
      tagline: 'text-xs sm:text-sm',
      gu: 'text-xs sm:text-sm px-2 py-0.5',
    },
  };

  const currentSize = sizeClasses[size];

  const content = (
    <div className={`flex items-center gap-1.5 sm:gap-2 select-none min-w-0 ${className}`}>
      {/* Brand Icon Badge with Vector Leaf */}
      <div className={`${currentSize.icon} rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs shrink-0 border border-emerald-400/30`}>
        <svg className={`${currentSize.svg} text-white`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2L9.5 7.5L4 8L8 12.5L7 18L12 15L17 18L16 12.5L20 8L14.5 7.5L12 2Z" fill="rgba(255,255,255,0.2)" />
          <path d="M11 20A7 7 0 0 1 4 13C4 7 11 3 11 3S18 7 18 13A7 7 0 0 1 11 20Z" fill="currentColor" opacity="0.9" />
          <path d="M11 9V17" stroke="#047857" strokeWidth="2" />
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col leading-none min-w-0">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <div className={`${currentSize.title} tracking-tight font-sans flex items-center whitespace-nowrap`}>
            <span className="text-slate-900 dark:text-white font-black">Taaza</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">Tokra</span>
          </div>
          {showGujarati && (
            <span className={`${currentSize.gu} hidden xs:inline-flex rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800/80 tracking-normal whitespace-nowrap`}>
              તાજાટોકરા
            </span>
          )}
        </div>
        {showTagline && (
          <span className={`${currentSize.tagline} text-slate-500 dark:text-slate-400 font-medium tracking-normal mt-0.5 truncate`}>
            Taaza Phal, Taazi Sabzi — Seedha Ghar Tak.
          </span>
        )}
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link href={href} aria-label="TaazaTokra home" className="inline-block transition-transform hover:scale-[1.01] active:scale-98 min-w-0 rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}

export default BrandLogo;
