'use client';

import React from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  Clock, 
  MapPin, 
  AlertTriangle,
  Loader2,
  Banknote,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

export function CartDrawer() {
  const { 
    cart, 
    cartDrawerOpen, 
    closeCartDrawer, 
    updateQuantity, 
    clearCart,
    subtotal,
    first500Discount,
    codDiscount,
    deliveryCharge,
    finalPayable,
    minimumOrderMet,
    minOrderAmount,
    remainingAmountToMinimum,
    serverQuote,
    isLoadingQuote,
    isPlacingOrder,
    orderError,
    priceChangeAlert,
    dismissPriceChangeAlert,
    hasUnavailableItems,
    placeOrder,
    paymentMethod,
    setPaymentMethod,
    isOnlinePaymentEnabled
  } = useCart();

  const { user, customer, defaultAddress, isOnboarded, openAuthModal, openProfileModal } = useAuth();

  if (!cartDrawerOpen) return null;

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const minOrderProgress = Math.min(100, (subtotal / minOrderAmount) * 100);

  const handleCheckoutClick = async () => {
    if (!user || !isOnboarded) {
      openAuthModal();
      return;
    }

    if (!defaultAddress) {
      openProfileModal();
      return;
    }

    await placeOrder();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={closeCartDrawer}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  Your Basket (તમારું કાર્ટ)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} selected
                </p>
              </div>
            </div>

            <button 
              onClick={closeCartDrawer}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            
            {/* Price Alert Banner */}
            {priceChangeAlert && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-start justify-between gap-2 shadow-2xs">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">APMC Price Revision: </span>
                    {priceChangeAlert}
                  </div>
                </div>
                <button 
                  onClick={dismissPriceChangeAlert}
                  className="text-amber-700 font-bold hover:text-amber-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">Your Cart is Empty (કાર્ટ ખાલી છે)</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Add fresh vegetables directly sourced from APMC market at wholesale prices.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Minimum Order Indicator */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Minimum Order (મિનિમમ ઓર્ડર ₹{minOrderAmount.toFixed(0)})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      ₹{subtotal.toFixed(0)} / ₹{minOrderAmount.toFixed(0)}
                    </span>
                  </div>

                  {remainingAmountToMinimum > 0 ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                      Add ₹{remainingAmountToMinimum.toFixed(0)} more to place your order.
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Eligible for free morning delivery in Halol!
                    </p>
                  )}

                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        remainingAmountToMinimum > 0 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${minOrderProgress}%` }}
                    />
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  {(serverQuote?.items || cart.map((c) => ({
                    variant_id: c.variant.id,
                    product_id: c.product.id,
                    product_name_en: c.product.name_en,
                    product_name_gu: c.product.name_gu,
                    variant_name_en: c.variant.variant_name_en,
                    variant_name_gu: c.variant.variant_name_gu,
                    image_url: c.product.image_url,
                    quantity: c.quantity,
                    unit_price: c.variant.selling_price,
                    line_total: c.variant.selling_price * c.quantity,
                    is_available: true,
                    unavailability_reason: null,
                  }))).map((item) => (
                    <div 
                      key={item.variant_id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-slate-900 dark:text-white truncate">
                          {item.product_name_gu} <span className="font-normal text-slate-500">({item.product_name_en})</span>
                        </h4>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.variant_name_gu || item.variant_name_en} &bull; ₹{Number(item.unit_price).toFixed(0)}
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center justify-center font-bold text-xs shadow-2xs cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold font-mono text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Address Section */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Delivery Address (સરનામું)</span>
                    </span>
                    {user && (
                      <button
                        onClick={openProfileModal}
                        className="text-emerald-600 font-bold hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {defaultAddress ? (
                    <div className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      <strong>{customer?.full_name || 'You'}</strong> &bull; {customer?.mobile}<br />
                      {defaultAddress.flat_house_no}, {defaultAddress.society_street_name}, {defaultAddress.area_locality}, Halol
                    </div>
                  ) : (
                    <div className="text-amber-700 dark:text-amber-300 text-[11px]">
                      Add address during checkout to proceed with delivery.
                    </div>
                  )}

                  <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    <span>Slot: Tomorrow Morning 10:00 AM - 01:00 PM</span>
                  </div>
                </div>

                {/* Bill Breakdown */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(0)}</span>
                  </div>
                  {first500Discount > 0 && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>FIRST500 (10% OFF):</span>
                      <span>-₹{first500Discount.toFixed(0)}</span>
                    </div>
                  )}
                  {codDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>COD 2% Cash Discount:</span>
                      <span>-₹{codDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Delivery:</span>
                    <span className="text-emerald-600 font-bold">FREE</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                    <span>Final Amount:</span>
                    <span>₹{finalPayable.toFixed(0)}</span>
                  </div>
                </div>

                {orderError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{orderError}</span>
                  </div>
                )}
              </>
            )}

          </div>

          {/* Footer Action */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-2">
              <button
                type="button"
                onClick={handleCheckoutClick}
                disabled={!minimumOrderMet || isPlacingOrder || hasUnavailableItems}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-md shadow-emerald-600/20 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>
                  {isPlacingOrder 
                    ? 'Placing Order...' 
                    : !user || !isOnboarded 
                    ? 'Enter Mobile to Continue' 
                    : `Place Order &bull; ₹${finalPayable.toFixed(0)} COD`}
                </span>
                {isPlacingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>

              <div className="text-[10px] text-center text-slate-400">
                🔒 Safe & Free Delivery &bull; Zero Plastic Waste
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
