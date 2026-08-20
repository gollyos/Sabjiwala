'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { 
  ShoppingBag, 
  User, 
  MapPin, 
  ShieldCheck, 
  ChevronDown
} from 'lucide-react';
import { PromoCountdownBanner } from './PromoCountdownBanner';
import { BrandLogo } from './ui/BrandLogo';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  const { user, customer, isOnboarded, openAuthModal, openProfileModal, verifiedSequence } = useAuth();
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
      
      {/* Live Promo Offer & Countdown Banner */}
      <PromoCountdownBanner />

      {/* Top Delivery Notification Bar (Desktop only to prevent mobile cramping) */}
      <div className="hidden sm:flex bg-emerald-950 text-emerald-100 text-xs px-4 py-1.5 font-medium items-center justify-between overflow-x-auto border-b border-emerald-800/40">
        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>⚡ <strong>Halol Morning Delivery</strong>: Orders confirmed before <strong>8:00 PM</strong> delivered next day 10 AM – 1 PM.</span>
        </div>
        <div className="flex items-center space-x-3 text-emerald-300 shrink-0">
          <span className="flex items-center gap-1 font-semibold">
            <MapPin className="w-3 h-3 text-emerald-400" />
            Halol APMC Sourced
          </span>
          <span>•</span>
          <span className="font-semibold">₹200 Min Order</span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand & Location */}
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <div className="hidden sm:block">
            <BrandLogo size="md" showGujarati={true} />
          </div>
          <div className="sm:hidden">
            <BrandLogo size="sm" showGujarati={false} />
          </div>
          <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold pl-3 border-l border-slate-200 dark:border-slate-700">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Halol, Panchmahal (389350)</span>
          </div>
        </div>

        {/* Right Actions: Auth & Cart */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          
          {/* User Profile / Login */}
          {user && isOnboarded && customer ? (
            <button
              onClick={openProfileModal}
              className="flex items-center space-x-1.5 sm:space-x-2 p-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 font-semibold text-xs transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
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
            </button>
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
            className="flex items-center space-x-1 sm:space-x-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm shadow-xs shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Basket</span>
            {totalItemCount > 0 && (
              <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-white text-emerald-800 font-black text-[10px] sm:text-xs shadow-xs">
                {totalItemCount}
              </span>
            )}
          </button>

        </div>

      </div>

    </header>
  );
}
