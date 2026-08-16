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
  CreditCard,
  Smartphone,
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
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  તમારું કાર્ટ (Your Cart)
                </h3>
                <p className="text-xs text-slate-500">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} selected
                </p>
              </div>
            </div>

            <button 
              onClick={closeCartDrawer}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            
            {/* Price update banner */}
            {priceChangeAlert && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start justify-between gap-2 shadow-xs">
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
              <div className="py-16 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-base">કાર્ટ ખાલી છે (Cart is Empty)</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Explore fresh vegetables directly sourced from APMC market at guaranteed wholesale prices.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Minimum Order Indicator */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">
                      મિનિમમ ઓર્ડર (Minimum Order ₹{minOrderAmount.toFixed(0)})
                    </span>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{subtotal.toFixed(2)} / ₹{minOrderAmount.toFixed(0)}
                    </span>
                  </div>

                  {remainingAmountToMinimum > 0 ? (
                    <p className="text-[11px] text-amber-700 font-medium">
                      Add <span className="font-bold">₹{remainingAmountToMinimum.toFixed(2)}</span> more to meet minimum order criteria.
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                      Minimum order requirement satisfied! Eligible for free morning delivery in Halol.
                    </p>
                  )}

                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        remainingAmountToMinimum > 0 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${minOrderProgress}%` }}
                    />
                  </div>
                </div>

                {/* Items List (Driven by Authoritative Server Quote when available) */}
                <div className="space-y-3">
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
                      className={`p-3.5 rounded-2xl bg-white border shadow-xs flex items-center justify-between gap-3 transition-all ${
                        !item.is_available ? 'border-red-300 bg-red-50/40' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {item.product_name_gu}
                          </h4>
                          {!item.is_available && (
                            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold">
                              Unavailable
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {item.product_name_en} • {item.variant_name_gu || item.variant_name_en}
                        </div>
                        {item.is_available ? (
                          <div className="text-xs font-semibold text-emerald-700 mt-1">
                            ₹{Number(item.unit_price).toFixed(2)} × {item.quantity} = ₹{Number(item.line_total).toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-[11px] font-semibold text-red-600 mt-1">
                            {item.unavailability_reason || 'Out of stock'}
                          </div>
                        )}
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center space-x-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                          disabled={!item.is_available}
                          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Address Preview Section */}
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Delivery Location
                    </span>
                    {isOnboarded && (
                      <button 
                        onClick={openProfileModal}
                        className="text-emerald-600 hover:underline capitalize text-xs cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {isOnboarded && defaultAddress ? (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-0.5">
                        <span>{customer?.full_name}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-semibold">
                          Default ({defaultAddress.address_type})
                        </span>
                      </div>
                      <div>{defaultAddress.flat_house_no}, {defaultAddress.society_street_name}</div>
                      <div className="text-slate-500">
                        {defaultAddress.landmark && `${defaultAddress.landmark}, `}
                        {defaultAddress.area_locality}, Halol - {defaultAddress.pincode}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openAuthModal()}
                      className="w-full p-3.5 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Sign In with Phone OTP to Add Delivery Address</span>
                    </button>
                  )}
                </div>

                {/* Payment Method Selector */}
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Payment Method (ચુકવણી પદ્ધતિ)</span>
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      100% Secure
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* COD Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cod')}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative cursor-pointer ${
                        paymentMethod === 'cod'
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <Banknote className={`w-5 h-5 ${paymentMethod === 'cod' ? 'text-emerald-700' : 'text-slate-500'}`} />
                        <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          2% OFF
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Cash on Delivery</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Pay at doorstep</div>
                    </button>

                    {/* Online Payment Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('online')}
                      disabled={!isOnlinePaymentEnabled}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        paymentMethod === 'online'
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          <Smartphone className={`w-4 h-4 ${paymentMethod === 'online' ? 'text-emerald-700' : 'text-slate-500'}`} />
                          <CreditCard className={`w-4 h-4 ${paymentMethod === 'online' ? 'text-emerald-700' : 'text-slate-500'}`} />
                        </div>
                        <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200">
                          UPI / Card
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Online Payment</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Instant via Razorpay</div>
                    </button>
                  </div>
                </div>

                {/* Authoritative Server Bill Breakdown */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Vegetables Merchandise Subtotal</span>
                    <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
                  </div>

                  {first500Discount > 0 ? (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        FIRST500 Launch Offer (10%)
                      </span>
                      <span>- ₹{first500Discount.toFixed(2)}</span>
                    </div>
                  ) : (
                    serverQuote?.promotion?.reason && (
                      <div className="text-[10px] text-slate-400 italic">
                        {serverQuote.promotion.reason}
                      </div>
                    )
                  )}

                  {paymentMethod === 'cod' && codDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3 h-3" />
                        Cash on Delivery Discount (2%)
                      </span>
                      <span>- ₹{codDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charge (Halol)</span>
                    <span className="font-bold text-emerald-700 uppercase">
                      {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>
                      {paymentMethod === 'cod' ? 'Final Cash Payable on Arrival' : 'Final Payable Amount'}
                    </span>
                    <div className="text-right">
                      <span className="text-emerald-700 text-base font-mono font-bold">₹{finalPayable.toFixed(2)}</span>
                      {isLoadingQuote && (
                        <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1 justify-end">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>Syncing quote...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {orderError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span>{orderError}</span>
                  </div>
                )}

                {hasUnavailableItems && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span>Some items in your cart are currently out of stock. Please adjust quantities.</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer CTA */}
          {cart.length > 0 && (
            <div className="p-6 bg-white border-t border-slate-100 shadow-lg space-y-2">
              <button
                onClick={handleCheckoutClick}
                disabled={isLoadingQuote || isPlacingOrder || !minimumOrderMet || hasUnavailableItems}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed text-base"
              >
                {isPlacingOrder ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>
                      {paymentMethod === 'online' ? 'Opening Razorpay Gateway...' : 'Placing Your COD Order...'}
                    </span>
                  </>
                ) : isLoadingQuote ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Calculating Server Quote...</span>
                  </>
                ) : !user || !isOnboarded ? (
                  <>
                    <span>Sign In to Place Order</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : !minimumOrderMet ? (
                  <span>Add ₹{remainingAmountToMinimum.toFixed(0)} More for Min Order</span>
                ) : hasUnavailableItems ? (
                  <span>Remove Unavailable Items</span>
                ) : paymentMethod === 'online' ? (
                  <>
                    <span>Pay Securely Online • ₹{finalPayable.toFixed(0)}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <span>Place COD Order • ₹{finalPayable.toFixed(0)}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Verified APMC Rates • Morning Halol Delivery</span>
                <button
                  onClick={clearCart}
                  className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
