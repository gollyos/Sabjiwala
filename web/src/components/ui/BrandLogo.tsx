import Link from 'next/link';
import Image from 'next/image';

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
      iconPx: 28,
      title: 'text-sm font-black',
      tagline: 'text-[9px]',
      gu: 'text-[9px] px-1 py-0.2',
    },
    md: {
      icon: 'w-9 h-9 text-sm',
      iconPx: 36,
      title: 'text-base sm:text-lg font-black',
      tagline: 'text-[10px] sm:text-xs',
      gu: 'text-[10px] sm:text-xs px-1.5 py-0.5',
    },
    lg: {
      icon: 'w-12 h-12 text-base',
      iconPx: 48,
      title: 'text-xl sm:text-2xl font-black',
      tagline: 'text-xs sm:text-sm',
      gu: 'text-xs sm:text-sm px-2 py-0.5',
    },
  };

  const currentSize = sizeClasses[size];

  const content = (
    <div className={`flex items-center gap-1.5 sm:gap-2 select-none min-w-0 ${className}`}>
      {/* Brand Logo Mark */}
      <div className={`${currentSize.icon} rounded-full overflow-hidden shrink-0 shadow-xs ring-1 ring-emerald-400/30`}>
        <Image
          src="/logo.png"
          alt="Taji Tokri"
          width={currentSize.iconPx}
          height={currentSize.iconPx}
          className="w-full h-full object-cover"
          priority
        />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col leading-none min-w-0">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <div className={`${currentSize.title} tracking-tight font-sans flex items-center gap-1 whitespace-nowrap`}>
            <span className="text-slate-900 dark:text-white font-black">Taji</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">Tokri</span>
          </div>
          {showGujarati && (
            <span className={`${currentSize.gu} hidden xs:inline-flex rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800/80 tracking-normal whitespace-nowrap`}>
              તાજી ટોકરી
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
      <Link href={href} aria-label="Taji Tokri home" className="inline-block transition-transform hover:scale-[1.01] active:scale-98 min-w-0 rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}

export default BrandLogo;
