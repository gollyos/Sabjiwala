'use client';

import React from 'react';

export interface StickerItemSummary {
  name_en: string;
  name_gu: string;
  variant_en: string;
  variant_gu: string;
  qty: number;
  unit: string;
}

export interface StickerPayload {
  header: string;
  order_id: string;
  order_number: string;
  bag_id: string;
  bag_barcode: string;
  bag_sequence: number;
  total_bags: number;
  customer_name: string;
  customer_mobile_masked: string;
  delivery_date: string;
  delivery_slot: string;
  delivery_area: string;
  delivery_society_street?: string;
  payment_method: string;
  final_payable_amount: number;
  collect_cash_text: string;
  qr_token: string;
  qr_url: string;
  items_summary?: StickerItemSummary[];
  is_reprint?: boolean;
  reprint_reason?: string;
  printed_at: string;
  barcodeSvg?: string;
  qrSvg?: string;
}

interface ThermalBagStickerProps {
  payload: StickerPayload;
  size?: '100x150' | '100x75';
  showItems?: boolean;
}

export default function ThermalBagSticker({
  payload,
  size = '100x150',
  showItems = true,
}: ThermalBagStickerProps) {
  const isCompact = size === '100x75';

  return (
    <div
      className={`thermal-sticker-page bg-white text-black p-4 border-2 border-black font-sans box-border ${
        isCompact ? 'h-[75mm] max-h-[75mm]' : 'h-[150mm] max-h-[150mm]'
      } w-[100mm] max-w-[100mm] mx-auto flex flex-col justify-between overflow-hidden print:p-2 print:border-none print:m-0`}
      style={{
        pageBreakAfter: 'always',
        breakAfter: 'page',
      }}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2">
          <div>
            <div className="text-xl font-black tracking-wider uppercase font-mono">TAAZATOKRA</div>
            <div className="text-[10px] font-bold text-gray-700">Halol Fresh Fruits &amp; Vegetables</div>
          </div>
          <div className="text-right">
            <div className="px-2 py-0.5 bg-black text-white text-xs font-black rounded font-mono">
              BAG {payload.bag_sequence} / {payload.total_bags}
            </div>
            {payload.is_reprint && (
              <div className="text-[9px] font-bold text-red-600 uppercase mt-0.5">
                REPRINT {payload.reprint_reason ? `(${payload.reprint_reason})` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Order & Customer Info */}
        <div className="grid grid-cols-2 gap-2 text-xs border-b-2 border-black pb-2 mb-2">
          <div>
            <div className="text-[9px] font-bold uppercase text-gray-600">Order Number</div>
            <div className="text-base font-black font-mono tracking-tight">{payload.order_number}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase text-gray-600">Customer</div>
            <div className="text-sm font-bold truncate">{payload.customer_name}</div>
            <div className="text-[11px] font-mono font-semibold">{payload.customer_mobile_masked}</div>
          </div>
        </div>

        {/* Delivery Details */}
        <div className="text-xs border-b-2 border-black pb-2 mb-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[9px] font-bold uppercase text-gray-600">Delivery Address (Halol)</div>
              <div className="font-bold text-sm">{payload.delivery_area}</div>
              {payload.delivery_society_street && (
                <div className="text-[11px] text-gray-800 truncate max-w-[220px]">
                  {payload.delivery_society_street}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase text-gray-600">Slot</div>
              <div className="font-bold text-xs">{payload.delivery_slot}</div>
              <div className="text-[10px] font-mono">
                {new Date(payload.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Payment & COD Collect Box */}
        <div className="p-2 border-2 border-black bg-gray-100 rounded mb-2 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase text-gray-700">Payment Mode</div>
            <div className="text-xs font-black font-mono">{payload.payment_method}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-gray-700 uppercase">Cash to Collect</div>
            <div className="text-lg font-black font-mono tracking-tight">
              ₹{Number(payload.final_payable_amount).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Optional Items Summary (if 100x150mm size and enabled) */}
        {!isCompact && showItems && payload.items_summary && payload.items_summary.length > 0 && (
          <div className="border-b-2 border-black pb-2 mb-2">
            <div className="text-[9px] font-bold uppercase text-gray-600 mb-1">Items Summary</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] max-h-[28mm] overflow-hidden leading-tight font-sans">
              {payload.items_summary.slice(0, 8).map((it, idx) => (
                <div key={idx} className="truncate">
                  • <strong>{it.name_gu}</strong> ({it.variant_gu || it.variant_en}) ×{it.qty}
                </div>
              ))}
              {payload.items_summary.length > 8 && (
                <div className="text-[9px] italic text-gray-600">+ {payload.items_summary.length - 8} more items...</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Barcode & QR Code Bottom Section */}
      <div className="pt-1">
        <div className="flex items-center justify-between gap-2">
          {/* Barcode */}
          <div className="flex-1 text-center">
            {payload.barcodeSvg ? (
              <div
                className="barcode-container flex justify-center"
                dangerouslySetInnerHTML={{ __html: payload.barcodeSvg }}
              />
            ) : (
              <div className="font-mono text-xs font-bold">{payload.bag_barcode}</div>
            )}
          </div>

          {/* QR Code */}
          {payload.qrSvg && (
            <div className="w-[24mm] h-[24mm] shrink-0 flex items-center justify-center p-0.5 border border-black rounded">
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: payload.qrSvg }}
              />
            </div>
          )}
        </div>

        <div className="text-center text-[8px] font-mono text-gray-500 mt-1">
          Scan QR/Barcode to verify dispatch • {payload.bag_barcode}
        </div>
      </div>
    </div>
  );
}
