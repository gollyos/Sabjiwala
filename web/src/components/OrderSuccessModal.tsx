'use client';

import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, Calendar, Clock, MapPin, X, ArrowRight, Tag, Banknote, CreditCard, ShieldCheck, MessageCircle } from 'lucide-react';
import Link from 'next/link';
export function OrderSuccessModal() {
  const { orderSuccessData, closeOrderSuccessModal } = useCart();
  const { defaultAddress, customer } = useAuth();

  if (!orderSuccessData) return null;

  const isOnline = orderSuccessData.payment_method?.includes('online');

  // Construct direct WhatsApp message link
  const supportPhone = process.env.NEXT_PUBLIC_STORE_PHONE?.replace(/\D/g, '');
  const deliveryDateStr = orderSuccessData.delivery_date
    ? new Date(orderSuccessData.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Tomorrow';
  const addressStr = defaultAddress 
    ? `${defaultAddress.flat_house_no || ''}, ${defaultAddress.society_street_name}, ${defaultAddress.area_locality}, Halol`
    : 'Halol';

  const waText = encodeURIComponent(
    `*TaazaTokra Halol - Order Confirmation (ઓર્ડર વિગતો)* 🍎🥦\n\n` +
    `*Order No:* ${orderSuccessData.order_number}\n` +
    `*Customer:* ${customer?.full_name || 'Customer'}\n` +
    `*Delivery Date:* ${deliveryDateStr}\n` +
    `*Delivery Slot:* 10:00 AM – 1:00 PM\n` +
    `*Delivery Address:* ${addressStr}\n` +
    `*Payment Mode:* ${isOnline ? 'Online Paid' : 'Cash on Delivery (COD)'}\n` +
    `*Amount to Pay:* ₹${orderSuccessData.final_payable_amount.toFixed(2)}\n\n` +
    `_Please confirm my fresh fruits & vegetables delivery!_`
  );

  const whatsappShareUrl = supportPhone ? `https://wa.me/${supportPhone}?text=${waText}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/80 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 dark:border-slate-800 animate-scale-up text-center p-6 sm:p-8">
        
        <button
          onClick={closeOrderSuccessModal}
          aria-label="Close order success modal"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner ring-8 ring-emerald-50 dark:ring-emerald-950/30">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          {isOnline ? 'Payment Successful!' : 'Order Confirmed!'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          {isOnline
            ? 'ઓનલાઇન ચુકવણી સફળ થઈ. આપનો ઓર્ડર કન્ફર્મ થઈ ગયો છે.'
            : 'આપનો તાજા ફળો અને શાકભાજીનો ઓર્ડર સફળતાપૂર્વક નોંધાઈ ગયો છે.'}
        </p>

        {/* Order Details Card */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-left space-y-3 mb-6">
          <div className="flex justify-between items-center pb-2.5 border-b border-emerald-200/60 dark:border-emerald-800/40">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Order Number</span>
            <span className="text-sm font-bold text-emerald-900 dark:text-emerald-300 font-mono">
              {orderSuccessData.order_number}
            </span>
          </div>

          {orderSuccessData.delivery_date && (
            <div className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>
                Delivery Date: <strong>{deliveryDateStr}</strong>
              </span>
            </div>
          )}

          <div className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>
              Delivery Slot: <strong>10:00 AM – 1:00 PM (Halol)</strong>
            </span>
          </div>

          {defaultAddress && (
            <div className="flex items-start space-x-2.5 text-xs text-slate-700 dark:text-slate-300">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                {addressStr}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300">
            {isOnline ? (
              <>
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="flex items-center gap-1.5">
                  Payment: <strong>Online (Prepaid • Paid)</strong>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>Payment: <strong>Cash on Delivery (ડિલિવરી સમયે રોકડ)</strong></span>
              </>
            )}
          </div>

          {orderSuccessData.first_order_discount > 0 && (
            <div className="p-2 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/50 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
              <span>You saved ₹{orderSuccessData.first_order_discount.toFixed(2)} with FIRST500 offer!</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2.5 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              {isOnline ? 'Amount Paid' : 'Total Cash to Pay on Arrival'}
            </span>
            <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 font-mono">
              ₹{orderSuccessData.final_payable_amount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* WhatsApp Direct Share Button */}
          {whatsappShareUrl && (
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold rounded-2xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer text-xs min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Receive Bill on WhatsApp (વૉટ્સએપ બિલ)</span>
            </a>
          )}

          <Link
            href="/profile"
            onClick={closeOrderSuccessModal}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer text-xs min-h-[44px]"
          >
            <span>View in My Orders (મારા ઓર્ડર)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <button
            onClick={closeOrderSuccessModal}
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
          >
            Continue Shopping (વધુ ખરીદી કરો)
          </button>
        </div>

      </div>
    </div>
  );
}
