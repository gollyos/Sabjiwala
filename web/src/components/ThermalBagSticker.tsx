'use client';

export interface StickerItemSummary {
  name_en: string;
  name_gu: string;
  variant_en: string;
  variant_gu: string;
  qty: number;
  unit: string;
  unit_price?: number;
  line_total?: number;
}

export interface StickerPayload {
  header?: string;
  order_id: string;
  order_number: string;
  order_date?: string;
  bag_id: string;
  bag_barcode: string;
  bag_sequence: number;
  total_bags: number;
  customer_name: string;
  customer_mobile?: string;
  customer_mobile_masked?: string;
  delivery_date: string;
  delivery_slot: string;
  delivery_area: string;
  delivery_society_street?: string;
  delivery_flat_house?: string;
  delivery_landmark?: string;
  payment_method: string;
  payment_status?: string;
  subtotal_amount?: number;
  discount_amount?: number;
  promo_discount?: number;
  first_order_discount?: number;
  cod_discount?: number;
  delivery_charge?: number;
  final_payable_amount: number;
  collect_cash_text?: string;
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
  size?: '100x150' | '100x75' | 'auto';
  showItems?: boolean;
}

export default function ThermalBagSticker({
  payload,
  size = '100x150',
  showItems = true,
}: ThermalBagStickerProps) {
  const isCompact = size === '100x75';
  
  // Compute calculated subtotal and discounts if not provided
  const items = payload.items_summary || [];
  const itemsCalculatedSubtotal = items.reduce(
    (sum, it) => sum + (it.line_total || (Number(it.unit_price || 0) * Number(it.qty || 1))),
    0
  );
  
  const subtotal = Number(payload.subtotal_amount || itemsCalculatedSubtotal || payload.final_payable_amount || 0);
  const totalDiscount = Number(
    payload.discount_amount ||
    (Number(payload.promo_discount || 0) + Number(payload.first_order_discount || 0) + Number(payload.cod_discount || 0)) ||
    Math.max(0, subtotal - Number(payload.final_payable_amount || 0))
  );
  const deliveryFee = Number(payload.delivery_charge || 0);
  const finalAmount = Number(payload.final_payable_amount || (subtotal - totalDiscount + deliveryFee));

  const isCOD = payload.payment_method.toUpperCase().includes('COD') || payload.payment_method.toUpperCase().includes('CASH');
  const displayPhone = payload.customer_mobile || payload.customer_mobile_masked || '';

  // Formatted date strings
  const formattedDeliveryDate = payload.delivery_date
    ? new Date(payload.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div
      className={`thermal-receipt-container bg-white text-black p-3.5 border-2 border-black font-sans box-border w-[80mm] sm:w-[90mm] md:w-[100mm] max-w-[100mm] mx-auto flex flex-col justify-between overflow-hidden print:p-1.5 print:border-none print:m-0 print:w-full`}
      style={{
        pageBreakAfter: 'always',
        breakAfter: 'page',
      }}
    >
      <div>
        {/* Top Header & Store Info */}
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <div className="text-xl font-black tracking-widest uppercase font-mono leading-none">
            TAJI TOKRI
          </div>
          <div className="text-xs font-extrabold text-gray-900 mt-0.5" lang="gu">
            સબ્જીવાલા (Halol Fresh)
          </div>
          <div className="text-[9px] font-semibold text-gray-600 tracking-tight">
            Daily APMC Fresh Vegetables &amp; Fruits • Halol
          </div>
          <div className="inline-block mt-1 px-2.5 py-0.5 bg-black text-white text-[10px] font-extrabold uppercase rounded font-mono">
            RETAIL BILL / ડિલિવરી પહોંચ
          </div>
        </div>

        {/* Bill & Order Details Meta */}
        <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-dashed border-black pb-2 mb-2 font-mono">
          <div>
            <span className="text-[9px] uppercase text-gray-600 block font-sans">Order / Bill No:</span>
            <strong className="text-xs font-black">{payload.order_number}</strong>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase text-gray-600 block font-sans">Bag No:</span>
            <strong className="text-xs font-black">BAG {payload.bag_sequence} / {payload.total_bags}</strong>
          </div>
          <div className="col-span-2 pt-0.5 text-[10px] text-gray-800 flex justify-between">
            <span>📅 <strong>Delivery:</strong> {formattedDeliveryDate}</span>
            <span>⏰ {payload.delivery_slot || '10 AM - 1 PM'}</span>
          </div>
          {payload.is_reprint && (
            <div className="col-span-2 text-[9px] font-bold text-red-600 uppercase text-center mt-0.5">
              ** DUPLICATE REPRINT {payload.reprint_reason ? `(${payload.reprint_reason})` : ''} **
            </div>
          )}
        </div>

        {/* Customer & Address Details */}
        <div className="text-xs border-b border-dashed border-black pb-2 mb-2">
          <div className="text-[9px] font-extrabold uppercase tracking-wider text-gray-600">Customer Details:</div>
          <div className="flex justify-between items-baseline mt-0.5">
            <strong className="text-xs font-bold text-black">{payload.customer_name}</strong>
            <span className="font-mono text-[11px] font-bold">{displayPhone}</span>
          </div>
          <div className="text-[10px] text-gray-800 leading-tight mt-1">
            {payload.delivery_flat_house && <span>{payload.delivery_flat_house}, </span>}
            {payload.delivery_society_street && <span>{payload.delivery_society_street}, </span>}
            {payload.delivery_landmark && <span className="italic">(Near {payload.delivery_landmark}), </span>}
            <span className="font-semibold text-black">{payload.delivery_area}, Halol</span>
          </div>
        </div>

        {/* Complete Itemized Table */}
        {showItems && items.length > 0 && (
          <div className="border-b-2 border-black pb-2 mb-2">
            <div className="text-[10px] font-mono border-b border-black pb-1 mb-1 font-bold flex justify-between text-gray-700">
              <span className="w-1/2">ITEM / શાકભાજી</span>
              <span className="w-1/6 text-center">QTY</span>
              <span className="w-1/6 text-right">RATE</span>
              <span className="w-1/6 text-right">TOTAL</span>
            </div>

            <div className="space-y-1.5 text-[10px] leading-tight font-sans">
              {items.map((it, idx) => {
                const itemRate = it.unit_price ? Number(it.unit_price) : 0;
                const itemTotal = it.line_total ? Number(it.line_total) : (itemRate * Number(it.qty || 1));

                return (
                  <div key={idx} className="flex justify-between items-start border-b border-dotted border-gray-300 pb-1">
                    <div className="w-1/2 pr-1">
                      <div className="font-bold text-black leading-snug">
                        {idx + 1}. {it.name_gu || it.name_en}
                      </div>
                      <div className="text-[9px] text-gray-600 font-medium">
                        {it.variant_gu || it.variant_en || it.name_en}
                      </div>
                    </div>
                    
                    <div className="w-1/6 text-center font-mono font-bold pt-0.5">
                      {it.qty}
                    </div>

                    <div className="w-1/6 text-right font-mono pt-0.5 text-gray-700">
                      {itemRate > 0 ? `₹${itemRate.toFixed(0)}` : '-'}
                    </div>

                    <div className="w-1/6 text-right font-mono font-extrabold text-black pt-0.5">
                      ₹{itemTotal > 0 ? itemTotal.toFixed(0) : (finalAmount / items.length).toFixed(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detailed Financial & Discount Breakdown */}
        <div className="text-xs font-mono border-b-2 border-black pb-2 mb-2 space-y-1">
          <div className="flex justify-between text-gray-800">
            <span>Subtotal (કુલ રકમ):</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

          {totalDiscount > 0 && (
            <div className="flex justify-between text-black font-bold">
              <span>Savings / છૂટ (Discount):</span>
              <span>- ₹{totalDiscount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-gray-800 text-[11px]">
            <span>Delivery Charge:</span>
            <span>{deliveryFee === 0 ? 'FREE (₹0.00)' : `₹${deliveryFee.toFixed(2)}`}</span>
          </div>

          <div className="border-t-2 border-black pt-1 flex justify-between items-baseline text-sm font-black">
            <span className="uppercase tracking-tight font-sans">FINAL TOTAL / ચોખ્ખી રકમ:</span>
            <span className="text-base font-black tracking-tight font-mono">₹{finalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Mode Box */}
        <div className={`p-2 border-2 border-black rounded mb-2 flex items-center justify-between ${
          isCOD ? 'bg-amber-50' : 'bg-emerald-50'
        }`}>
          <div>
            <div className="text-[9px] font-extrabold uppercase text-gray-600 font-sans">Payment Mode</div>
            <div className="text-xs font-black font-mono">{payload.payment_method}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-extrabold text-gray-700 uppercase font-sans">
              {isCOD ? '💵 Cash to Collect' : '✅ Payment Status'}
            </div>
            <div className="text-sm font-black font-mono">
              {isCOD ? `₹${finalAmount.toFixed(2)}` : 'PAID ONLINE'}
            </div>
          </div>
        </div>
      </div>

      {/* Barcode, QR Code & Footer Section */}
      <div className="pt-1">
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-gray-400 pt-2">
          {/* Barcode */}
          <div className="flex-1 text-center">
            {payload.barcodeSvg ? (
              <div
                className="barcode-container flex justify-center"
                dangerouslySetInnerHTML={{ __html: payload.barcodeSvg }}
              />
            ) : (
              <div className="font-mono text-[10px] font-bold">{payload.bag_barcode}</div>
            )}
          </div>

          {/* QR Code for Digital Tracking */}
          {payload.qrSvg && (
            <div className="w-[20mm] h-[20mm] shrink-0 flex items-center justify-center p-0.5 border border-black rounded bg-white">
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: payload.qrSvg }}
              />
            </div>
          )}
        </div>

        <div className="text-center text-[9px] text-gray-600 mt-1 font-sans">
          Scan QR for digital tracking &amp; live receipt • <strong>www.tajitokri.in</strong>
        </div>
        <div className="text-center text-[8px] font-bold text-gray-500 mt-0.5">
          તાજા શાકભાજી અને ફળો માટે આભાર! Thank you for supporting local farmers!
        </div>
      </div>
    </div>
  );
}
