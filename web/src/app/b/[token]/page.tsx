import React from 'react';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Package, ShieldCheck, CheckCircle2, AlertCircle, Clock, MapPin, Truck } from 'lucide-react';
import Link from 'next/link';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export default async function BagLookupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getServiceSupabase();

  // Find bag by token
  const { data: bag, error: bagErr } = await supabase
    .from('packing_bags')
    .select(`
      id,
      bag_barcode,
      bag_sequence,
      total_bags_snapshot,
      is_verified,
      packed_at,
      orders:order_id (
        id,
        order_number,
        delivery_date,
        delivery_area_snapshot,
        order_status,
        packing_status,
        payment_method,
        final_payable_amount
      )
    `)
    .eq('qr_token', token)
    .single();

  if (bagErr || !bag) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-700/50 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">Invalid or Expired Bag QR</h2>
          <p className="text-xs text-slate-400">
            This QR code token was not recognized in the Sabjiwala warehouse system.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
          >
            Go to Sabjiwala Home
          </Link>
        </div>
      </div>
    );
  }

  // Type safe order resolution
  const order = Array.isArray(bag.orders) ? bag.orders[0] : bag.orders;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-700/50 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-700/50">
            Verified Sabjiwala Package
          </span>
          <h1 className="text-2xl font-black font-mono tracking-tight mt-1">
            {bag.bag_barcode}
          </h1>
          <p className="text-xs text-slate-400">
            Bag {bag.bag_sequence} of {bag.total_bags_snapshot}
          </p>
        </div>

        {/* Verification Status Banner */}
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
          bag.is_verified
            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
            : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
        }`}>
          {bag.is_verified ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          ) : (
            <Clock className="w-6 h-6 text-amber-400 shrink-0" />
          )}
          <div className="text-xs">
            <div className="font-bold">
              {bag.is_verified ? 'Warehouse Verification Completed' : 'Packing in Progress'}
            </div>
            <div className="text-[11px] text-slate-400">
              {bag.is_verified ? 'This bag has been verified and cleared for delivery.' : 'Awaiting final warehouse barcode scan.'}
            </div>
          </div>
        </div>

        {/* Safe Dispatch Info */}
        {order && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Order Number</span>
              <span className="font-mono font-bold text-white">{order.order_number}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Delivery Slot</span>
              <span className="font-semibold text-slate-200">
                {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • 10 AM–1 PM
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Destination Area</span>
              <span className="font-semibold text-slate-200">{order.delivery_area_snapshot}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Payment Status</span>
              <span className="font-mono font-bold text-emerald-400 uppercase">
                {order.payment_method} • ₹{Number(order.final_payable_amount).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-500">
            Halol APMC Mandi Direct • Fresh Vegetable Delivery
          </p>
        </div>

      </div>
    </div>
  );
}
