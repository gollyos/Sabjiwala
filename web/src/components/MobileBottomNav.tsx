'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Home, Search, ShoppingBag, User } from 'lucide-react';

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { cart, openCartDrawer, subtotal } = useCart();
  const { user, isOnboarded, openAuthModal } = useAuth();

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Hide bottom nav on admin and driver routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/driver')) {
    return null;
  }

  const handleProfileClick = () => {
    if (!user || !isOnboarded) {
      openAuthModal();
    } else {
      router.push('/profile');
    }
  };

  const isHome = pathname === '/';
  const isProfile = pathname.startsWith('/profile');

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-4 items-center text-center">
        
        {/* 1. Home / Fresh Store */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            isHome 
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
              : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <Home className="w-5 h-5" />
            {isHome && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-600"></span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">ફળ-શાક</span>
        </Link>

        {/* 2. Search / Explore */}
        <button
          type="button"
          onClick={() => {
            if (pathname !== '/') {
              router.push('/#search');
            } else {
              window.scrollTo({ top: 120, behavior: 'smooth' });
            }
          }}
          className="flex flex-col items-center justify-center py-1 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-white transition-all cursor-pointer"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">શોધો</span>
        </button>

        {/* 3. Cart / Basket with live total & badge */}
        <button
          type="button"
          onClick={openCartDrawer}
          className={`relative flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            totalItemCount > 0
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <div className={`p-1 rounded-xl transition-colors ${totalItemCount > 0 ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : ''}`}>
              <ShoppingBag className="w-5 h-5" />
            </div>
            {totalItemCount > 0 && (
              <span className="absolute -top-1 -right-1.5 px-1.5 py-0.2 bg-[#ee8a2f] text-white rounded-full text-[9px] font-black font-mono shadow-xs animate-in zoom-in">
                {totalItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-extrabold">
            {totalItemCount > 0 ? `₹${subtotal.toFixed(0)}` : 'કાર્ટ'}
          </span>
        </button>

        {/* 4. Profile / Orders */}
        <button
          type="button"
          onClick={handleProfileClick}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
            isProfile 
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
              : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <User className="w-5 h-5" />
            {isProfile && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-600"></span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">
            {user ? 'ઓર્ડર્સ' : 'લૉગિન'}
          </span>
        </button>

      </div>
    </nav>
  );
}
