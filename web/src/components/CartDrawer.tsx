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
import { getDeliveryScheduleInfo } from '@/lib/deliveryHelper';

export function CartDrawer() {
  const deliveryInfo = getDeliveryScheduleInfo();
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

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-8">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
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
              aria-label="Close basket"
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 text-xs">
            
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
                  className="text-amber-700 font-bold hover:text-amber-900 cursor-pointer"
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
                    Add fresh vegetables & fruits directly sourced from APMC market at wholesale rates.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Minimum Order Indicator */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                      Minimum Order (મિનિમમ ₹{minOrderAmount.toFixed(0)})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono shrink-0">
                      ₹{subtotal.toFixed(0)} / ₹{minOrderAmount.toFixed(0)}
                    </span>
                  </div>

                  {remainingAmountToMinimum > 0 ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                      Add ₹{remainingAmountToMinimum.toFixed(0)} more to place your order.
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Eligible for free morning delivery in Halol!</span>
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
                <div className="space-y-2.5">
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
                      className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 shadow-2xs"
                    >
                      {/* Left side: Product Info */}
                      <div className="flex-1 min-w-0 pr-1">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                          {item.product_name_gu} <span className="font-normal text-slate-500 text-xs">({item.product_name_en})</span>
                        </h4>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded-md font-semibold text-slate-600 dark:text-slate-300 text-[10px]">
                            {item.variant_name_gu || item.variant_name_en}
                          </span>
                          <span>•</span>
                          <span>₹{Number(item.unit_price).toFixed(0)}</span>
                        </div>
                      </div>

                      {/* Right side: Stepper + Line Subtotal */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                            aria-label="Decrease item"
                            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center justify-center font-bold text-xs shadow-2xs cursor-pointer active:scale-95"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold font-mono text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                            aria-label="Increase item"
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs cursor-pointer active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Calculated Line Subtotal */}
                        <div className="w-12 text-right font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0">
                          ₹{Number(item.line_total).toFixed(0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Address Section */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Delivery Address (સરનામું)</span>
                    </span>
                    {user && (
                      <button
                        onClick={openProfileModal}
                        className="text-emerald-600 font-bold hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {defaultAddress ? (
                    <div className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      <strong>{customer?.full_name || 'You'}</strong> • {customer?.mobile}<br />
                      {defaultAddress.flat_house_no}, {defaultAddress.society_street_name}, {defaultAddress.area_locality}, Halol
                    </div>
                  ) : (
                    <div className="text-amber-700 dark:text-amber-300 text-[11px]">
                      Add address during checkout to proceed with delivery.
                    </div>
                  )}

                  <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span>Slot: Delivery Window 10:00 AM - 1:00 PM</span>
                  </div>
                </div>

                {/* Bill Breakdown (Guaranteed Full Width & Non-clipping) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                    <span>Item Subtotal:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">₹{subtotal.toFixed(0)}</span>
                  </div>

                  {first500Discount > 0 && (
                    <div className="flex justify-between items-center text-amber-600 font-bold gap-2">
                      <span className="truncate">
                        {serverQuote?.promotion.order_index 
                          ? `FIRST500 (10% OFF • Order ${serverQuote.promotion.order_index}/3):` 
                          : 'FIRST500 (10% OFF):'}
                      </span>
                      <span className="shrink-0">-₹{first500Discount.toFixed(0)}</span>
                    </div>
                  )}

                  {codDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 font-bold gap-2">
                      <span className="truncate">COD Cash Discount (2%):</span>
                      <span className="shrink-0">-₹{codDiscount.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs">
                    <span>ડિલિવરી ({deliveryInfo.labelShortGu}):</span>
                    <span className="text-emerald-600 font-bold shrink-0">FREE</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-black text-sm text-slate-900 dark:text-white">
                    <span>Final Amount:</span>
                    <span className="text-emerald-600 font-bold text-base shrink-0">₹{finalPayable.toFixed(0)}</span>
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
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 space-y-2">
              <button
                type="button"
                onClick={handleCheckoutClick}
                disabled={!minimumOrderMet || isPlacingOrder || hasUnavailableItems}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-md shadow-emerald-600/20 flex items-center justify-between transition-all cursor-pointer"
              >
                <span className="truncate pr-2">
                  {isPlacingOrder 
                    ? 'Placing Order...' 
                    : !user || !isOnboarded 
                    ? 'Enter Mobile to Continue' 
                    : `Place Order • ₹${finalPayable.toFixed(0)} COD`}
                </span>
                {isPlacingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <ArrowRight className="w-4 h-4 shrink-0" />
                )}
              </button>

              <div className="text-[10px] text-center text-slate-500 dark:text-slate-400 font-medium space-y-0.5">
                <p>⚡ ડિલિવરી: <strong>{deliveryInfo.labelShortGu} ({deliveryInfo.labelShortEn})</strong></p>
                <p className="text-emerald-700 dark:text-emerald-400">📲 ઓર્ડર કન્ફર્મેશન અને લાઈવ ટ્રેકિંગ WhatsApp પર મોકલવામાં આવશે.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
