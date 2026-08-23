'use client';

import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, User, MapPin, ShieldCheck, ChevronDown } from 'lucide-react';
import { PromoCountdownBanner } from './PromoCountdownBanner';
import { BrandLogo } from './ui/BrandLogo';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
export function Navbar() {
  const pathname = usePathname();
  const { user, customer, isOnboarded, openAuthModal, verifiedSequence } = useAuth();
  const { cart, openCartDrawer } = useCart();

  // Hide customer navbar on Admin, Driver, and Tracking routes
  if (
    pathname.startsWith('/admin') || 
    pathname.startsWith('/driver') || 
    pathname.startsWith('/track') || 
    pathname.startsWith('/b/')
  ) {
    return null;
  }

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
      <div className="h-1 w-full bg-[linear-gradient(90deg,#0a5c35_0%,#0f7a45_35%,#ee8a2f_68%,#e0453a_100%)]" aria-hidden="true" />

      {/* Live Promo Offer & Countdown Banner */}
      <PromoCountdownBanner />

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">

        {/* Brand & Location */}
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <div className="hidden sm:block">
            <BrandLogo size="md" showGujarati={true} />
          </div>
          <div className="sm:hidden">
            <BrandLogo size="sm" showGujarati={false} />
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 font-bold pl-3 ml-1 border-l border-slate-200 dark:border-slate-700">
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 px-2.5 py-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              Halol, Panchmahal (389350)
            </span>
          </div>
        </div>

        {/* Right Actions: Auth & Cart */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          
          {/* User Profile / Login */}
          {user && isOnboarded && customer ? (
            <Link
              href="/profile"
              className="flex items-center space-x-1.5 sm:space-x-2 p-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 font-semibold text-xs transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                {customer.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="flex items-center gap-1">
                  <span className="truncate max-w-[100px]">{customer.full_name}</span>
                  {customer.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                </div>
                {verifiedSequence && (
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-normal">
                    Customer #{verifiedSequence}
                  </div>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 hidden sm:inline" />
            </Link>
          ) : (
            <button
              onClick={() => openAuthModal()}
              aria-label="Sign In"
              className="flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700"
            >
              <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="hidden sm:inline sm:ml-1.5">Sign In (લૉગિન)</span>
            </button>
          )}

          {/* Cart Drawer Trigger */}
          <button
            onClick={openCartDrawer}
            aria-label="View Basket"
            className="relative flex items-center space-x-1 sm:space-x-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] hover:brightness-110 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-900/25 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Basket</span>
            {totalItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 sm:static min-w-[18px] px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-[#ee8a2f] text-white font-black text-[10px] sm:text-xs shadow-sm ring-2 ring-white dark:ring-slate-900 sm:ring-0">
                {totalItemCount}
              </span>
            )}
          </button>

        </div>

      </div>

    </header>
  );
}
