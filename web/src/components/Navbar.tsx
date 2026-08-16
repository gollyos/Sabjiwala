'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { 
  ShoppingBag, 
  User, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  Phone,
  ChevronDown
} from 'lucide-react';

export function Navbar() {
  const { user, customer, isOnboarded, openAuthModal, openProfileModal, verifiedSequence } = useAuth();
  const { cart, openCartDrawer, subtotal } = useCart();

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
      
      {/* Top Notification Bar */}
      <div className="bg-emerald-900 text-emerald-100 text-xs px-4 py-1.5 font-medium flex items-center justify-between overflow-x-auto">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>⚡ <strong>Halol Daily Delivery</strong>: Orders confirmed before <strong>8:00 PM</strong> delivered next morning 10 AM – 1 PM.</span>
        </div>
        <div className="hidden sm:flex items-center space-x-3 text-emerald-200">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-400" />
            Halol APMC Sourced
          </span>
          <span>•</span>
          <span>₹200 Min Order</span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        
        {/* Brand & Location */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-emerald-600/20">
            🌱
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-lg sm:text-xl text-slate-900 leading-none">
                સબ્જીવાલા <span className="text-emerald-600 font-bold text-base sm:text-lg">Sabjiwala</span>
              </h1>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Halol, Panchmahal (389350)</span>
            </div>
          </div>
        </div>

        {/* Right Actions: Auth & Cart */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* User Profile / Login */}
          {user && isOnboarded && customer ? (
            <button
              onClick={openProfileModal}
              className="flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-950 font-semibold text-xs transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                {customer.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="flex items-center gap-1">
                  <span className="truncate max-w-[100px]">{customer.full_name}</span>
                  {customer.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                {verifiedSequence && (
                  <div className="text-[10px] text-emerald-700 font-normal">
                    Customer #{verifiedSequence}
                  </div>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          ) : (
            <button
              onClick={() => openAuthModal()}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              <User className="w-4 h-4 text-slate-500" />
              <span>Sign In (લૉગિન)</span>
            </button>
          )}

          {/* Cart Drawer Trigger */}
          <button
            onClick={openCartDrawer}
            className="relative flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Basket</span>
            {totalItemCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white text-emerald-800 font-extrabold text-xs shadow-xs">
                {totalItemCount}
              </span>
            )}
          </button>

        </div>

      </div>

    </header>
  );
}
