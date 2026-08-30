'use client';

import { getErrorMessage } from '@/lib/errors';




import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, MapPin, ShoppingBag, MessageCircle, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { mergeCartItems } = useCart();
  const token = params?.token as string;
  const supportPhone = '917069131300';
  const supportUrl = supportPhone
    ? `https://wa.me/${supportPhone}?text=Hi%20Taji Tokri%20Support,%20I%20need%20help%20with%20my%20order`
    : null;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [repeating, setRepeating] = useState(false);
  const [repeatResult, setRepeatResult] = useState<any | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/orders/track/${token}`);
        const json = await res.json();

        if (!json.success || !json.order) {
          throw new Error(json.error || 'Order not found');
        }

        setOrder(json.order);
      } catch (err) {
        setError(getErrorMessage(err) || 'Unable to load order details');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchOrder();
    }
  }, [token]);

  const handleRepeatOrder = async () => {
    try {
      setRepeating(true);
      const res = await fetch('/api/orders/repeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_token: token }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Repeat order failed');
      setRepeatResult(json);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setRepeating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-mono">Loading order status (ઓર્ડર વિગતો લોડ થઈ રહી છે)...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-700/50 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-white">Order Not Found (ઓર્ડર મળ્યો નથી)</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || 'This order link may have expired or is invalid. Please verify the URL from your WhatsApp message.'}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] hover:brightness-125 text-white text-xs font-bold transition-all shadow-lg"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Go to Taji Tokri Store</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'confirmed', label: 'Order Confirmed', labelGu: 'કન્ફર્મ થયેલ', desc: 'Received & verified' },
    { key: 'procurement', label: 'Mandi Procurement', labelGu: 'મંડી ખરીદી', desc: 'APMC fresh batch' },
    { key: 'packed', label: 'Godown Quality Pack', labelGu: 'પેકિંગ પૂર્ણ', desc: 'Cleaned & bagged' },
    { key: 'out_for_delivery', label: 'Out for Delivery', labelGu: 'ડિલિવરી માટે નીકળ્યો', desc: 'Driver on the way' },
    { key: 'delivered', label: 'Delivered', labelGu: 'પહોંચાડ્યો', desc: 'Payment completed' },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'confirmed': return 1;
      case 'packed': return 2;
      case 'out_for_delivery': return 3;
      case 'delivered': return 4;
      case 'failed_delivery': return 3;
      default: return 0;
    }
  };

  const currentStep = getStepIndex(order.status);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 font-sans">
      {/* Top Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-black bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              Taji Tokri 🌿
            </span>
          </Link>
          {supportUrl && (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 border border-emerald-700/60 rounded-full text-emerald-400 text-xs font-bold hover:bg-emerald-900 transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Support</span>
            </a>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Order Status Hero Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400">
                  {order.order_number}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  order.status === 'delivered'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : order.status === 'failed_delivery'
                    ? 'bg-red-950 text-red-400 border border-red-800'
                    : 'bg-blue-950 text-blue-400 border border-blue-800'
                }`}>
                  {order.status.replace('_', ' ')}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white mt-1">
                Delivery on {order.delivery_date}
              </h1>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs text-slate-400">Total COD Amount</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ₹{order.final_payable}
              </div>
            </div>
          </div>

          {/* Status Timeline */}
          <div className="space-y-4">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Order Timeline (ઓર્ડર પ્રગતિ)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div
                    key={step.key}
                    className={`p-3 rounded-2xl border text-xs space-y-1 transition-all ${
                      isCurrent
                        ? 'bg-emerald-950/60 border-emerald-500 shadow-lg'
                        : isPassed
                        ? 'bg-slate-950 border-slate-800 text-slate-300'
                        : 'bg-slate-950/40 border-slate-900 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isPassed ? (
                        <CheckCircle2 className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`} />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <span className={`font-bold ${isCurrent ? 'text-emerald-300' : ''}`}>
                        {step.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-gujarati">
                      {step.labelGu}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Delivery Window</span>
              </div>
              <div className="font-bold text-white">10:00 AM - 1:00 PM Daily</div>
              <div className="text-[10px] text-slate-400">Scheduled Halol delivery window</div>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>Delivery Area</span>
              </div>
              <div className="font-bold text-white">{order.delivery_address?.area || 'Halol'}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {order.delivery_address?.society_street || ''}
              </div>
            </div>
          </div>
        </div>

        {/* Itemized Vegetable List */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Ordered Items (ઓર્ડર કરેલા શાકભાજી)</span>
          </h2>

          <div className="divide-y divide-slate-800 text-xs">
            {order.items?.map((item: any, idx: number) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">
                    {item.name_en} <span className="text-slate-400 font-normal">/ {item.name_gu}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {item.quantity} {item.unit} × ₹{item.price}
                  </div>
                </div>

                <div className="text-right font-mono font-bold text-white">
                  ₹{Number(item.line_total).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Financial Breakdown */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">₹{order.subtotal}</span>
            </div>

            {order.first500_discount > 0 && (
              <div className="flex justify-between text-amber-400 font-bold">
                <span>FIRST500 Welcome Discount (10%)</span>
                <span className="font-mono">-₹{order.first500_discount}</span>
              </div>
            )}

            {order.cod_discount > 0 && (
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Cash on Delivery Discount (2%)</span>
                <span className="font-mono">-₹{order.cod_discount}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
              <span>Final Payable (COD)</span>
              <span className="text-emerald-400 font-mono">₹{order.final_payable}</span>
            </div>
          </div>
        </div>

        {/* Repeat Order Action */}
        <div className="bg-slate-900 border border-emerald-800/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <span>Repeat This Order (ફરી ઓર્ડર કરો)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Reload these vegetables with today’s live morning mandi prices.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRepeatOrder}
              disabled={repeating}
              className="px-4 py-2.5 bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] hover:brightness-125 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${repeating ? 'animate-spin' : ''}`} />
              <span>{repeating ? 'Checking Prices...' : 'Repeat Order'}</span>
            </button>
          </div>

          {repeatResult && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-xs">
              <div className="font-bold text-emerald-400">
                ✅ {repeatResult.available_count} items ready with today’s fresh mandi prices!
              </div>

              <div className="space-y-1.5">
                {repeatResult.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300">
                    <span>• {item.name_en} / {item.name_gu} ({item.quantity} {item.unit})</span>
                    <span className={item.is_available ? 'text-emerald-400 font-mono font-bold' : 'text-red-400'}>
                      {item.is_available ? `₹${item.current_price}` : 'Out of Stock'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (repeatResult?.items) {
                      const validItems = repeatResult.items
                        .filter((i: any) => i.is_available && i.product && i.variant)
                        .map((i: any) => ({
                          product: i.product,
                          variant: i.variant,
                          quantity: i.quantity,
                        }));
                      // Merge through cart context so provider state, persistence,
                      // and the price quote all update together. Writing
                      // localStorage directly is ignored by the mounted provider.
                      if (validItems.length > 0) {
                        mergeCartItems(validItems);
                      }
                    }
                    router.push('/?open_cart=true');
                  }}
                  className="w-full py-2.5 bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] hover:brightness-125 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer min-h-[44px]"
                >
                  Proceed to Checkout with Today’s Cart →
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
