'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Search,
  Phone,
  User,
  MapPin,
  Calendar,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { todayIST, toISTDateString } from '@/lib/istDate';
import ThermalBagSticker from '@/components/ThermalBagSticker';

interface VariantOption {
  id: string;
  variant_name_en: string;
  variant_name_gu: string;
  selling_price: number;
  multiplier_to_base_unit: number;
  unit_code?: string;
}

interface ProductOption {
  id: string;
  name_en: string;
  name_gu: string;
  image_url: string | null;
  category_id: string;
  variants: VariantOption[];
}

interface SelectedCartItem {
  variant_id: string;
  product_name_en: string;
  product_name_gu: string;
  variant_name_en: string;
  variant_name_gu: string;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface AdminAddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: any) => void;
}

const POPULAR_HALOL_AREAS = [
  'Halol Town (હાલોલ ટાઉન)',
  'GIDC Halol (જીઆઈડીસી)',
  'Godhra Road (ગોધરા રોડ)',
  'Pavagadh Road (પાવાગઢ રોડ)',
  'Kanjari Road (કંજરી રોડ)',
  'Vadodara Road (વડોદરા રોડ)',
  'Bypass Road (બાયપાસ રોડ)',
  'Rameshwar Society (રામેશ્વર સોસાયટી)',
  'Shivalik Residency (શિવાલિક)',
  'Vrundavan Society (વૃંદાવન)',
];

export function AdminAddOrderModal({ isOpen, onClose, onOrderCreated }: AdminAddOrderModalProps) {
  const [supabase] = useState(() => createClient());

  // Customer State
  const [mobile, setMobile] = useState('');
  const [fullName, setFullName] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);

  // Address State
  const [flatHouse, setFlatHouse] = useState('');
  const [societyStreet, setSocietyStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [selectedArea, setSelectedArea] = useState('Halol Town (હાલોલ ટાઉન)');
  const [customArea, setCustomArea] = useState('');
  const [pincode, setPincode] = useState('389350');

  // Delivery Timing
  const getTomorrowDate = () => {
    const now = new Date();
    const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return toISTDateString(tom);
  };
  const [deliveryDate, setDeliveryDate] = useState(() => getTomorrowDate());
  const [deliverySlot, setDeliverySlot] = useState<'morning' | 'evening'>('morning');

  // Products Catalog & Basket
  const [catalog, setCatalog] = useState<ProductOption[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [cartItems, setCartItems] = useState<SelectedCartItem[]>([]);

  // Payment & Financials
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'paid'>('cod');
  const [channel, setChannel] = useState<'phone_whatsapp' | 'manual_admin'>('phone_whatsapp');
  const [discount, setDiscount] = useState<string>('0');
  const [deliveryCharge, setDeliveryCharge] = useState<string>('0');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Submit / Status State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrderData, setCreatedOrderData] = useState<any | null>(null);
  const [showStickerPrint, setShowStickerPrint] = useState(false);

  // Load Catalog once opened
  useEffect(() => {
    if (!isOpen) return;

    const fetchCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            name_en,
            name_gu,
            image_url,
            category_id,
            product_variants (
              id,
              variant_name_en,
              variant_name_gu,
              selling_price,
              multiplier_to_base_unit,
              is_active,
              display_order
            )
          `)
          .eq('is_active', true)
          .order('display_order');

        if (error) throw error;

        const options: ProductOption[] = (data || []).map((p: any) => ({
          id: p.id,
          name_en: p.name_en,
          name_gu: p.name_gu,
          image_url: p.image_url,
          category_id: p.category_id,
          variants: (p.product_variants || [])
            .filter((v: any) => v.is_active !== false)
            .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
            .map((v: any) => ({
              id: v.id,
              variant_name_en: v.variant_name_en,
              variant_name_gu: v.variant_name_gu,
              selling_price: Number(v.selling_price || 0),
              multiplier_to_base_unit: Number(v.multiplier_to_base_unit || 1),
            })),
        }));

        setCatalog(options);
      } catch (err) {
        console.error('Failed to load product catalog for add order modal:', err);
      } finally {
        setLoadingCatalog(false);
      }
    };

    fetchCatalog();
  }, [isOpen, supabase]);

  // Auto-Lookup Customer when 10 digits are typed
  const handleMobileChange = useCallback(
    async (val: string) => {
      const clean = val.replace(/\D/g, '');
      setMobile(clean);
      setIsExistingCustomer(false);

      if (clean.length === 10) {
        setLookingUpCustomer(true);
        setError(null);
        try {
          const res = await fetch(`/api/admin/customers/lookup?mobile=${clean}`);
          const json = await res.json();
          if (json.success && json.customer) {
            setIsExistingCustomer(true);
            setFullName(json.customer.full_name || '');
            if (json.customer.alternate_mobile) {
              setAlternateMobile(json.customer.alternate_mobile);
            }
            if (json.defaultAddress) {
              setFlatHouse(json.defaultAddress.flat_house_no || '');
              setSocietyStreet(json.defaultAddress.society_street_name || '');
              setLandmark(json.defaultAddress.landmark || '');
              const area = json.defaultAddress.area_locality || '';
              if (POPULAR_HALOL_AREAS.some((a) => a.includes(area) || area.includes(a.split(' ')[0]))) {
                setSelectedArea(
                  POPULAR_HALOL_AREAS.find((a) => a.includes(area) || area.includes(a.split(' ')[0])) || area
                );
              } else {
                setSelectedArea('Other');
                setCustomArea(area);
              }
              setPincode(json.defaultAddress.pincode || '389350');
            }
          }
        } catch (err) {
          console.error('Customer lookup error:', err);
        } finally {
          setLookingUpCustomer(false);
        }
      }
    },
    []
  );

  // Filter Catalog
  const filteredCatalog = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return catalog.slice(0, 15);
    return catalog.filter(
      (p) =>
        p.name_en.toLowerCase().includes(q) ||
        p.name_gu.includes(productSearch.trim()) ||
        p.variants.some((v) => v.variant_name_en.toLowerCase().includes(q))
    );
  }, [catalog, productSearch]);

  // Add Item to Cart
  const addItemToCart = (product: ProductOption, variant: VariantOption) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.variant_id === variant.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          line_total: Math.round(newQty * updated[existingIdx].unit_price * 100) / 100,
        };
        return updated;
      }

      return [
        ...prev,
        {
          variant_id: variant.id,
          product_name_en: product.name_en,
          product_name_gu: product.name_gu,
          variant_name_en: variant.variant_name_en,
          variant_name_gu: variant.variant_name_gu,
          image_url: product.image_url,
          unit_price: variant.selling_price,
          quantity: 1,
          line_total: variant.selling_price,
        },
      ];
    });
  };

  // Update Cart Quantity
  const updateQuantity = (variantId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.variant_id !== variantId) return item;
          const newQty = Math.max(0, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            line_total: Math.round(newQty * item.unit_price * 100) / 100,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Update Cart Price Override
  const updateItemPrice = (variantId: string, price: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.variant_id !== variantId) return item;
        const p = Math.max(0, price);
        return {
          ...item,
          unit_price: p,
          line_total: Math.round(item.quantity * p * 100) / 100,
        };
      })
    );
  };

  // Remove Item
  const removeItem = (variantId: string) => {
    setCartItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, i) => acc + i.line_total, 0);
  }, [cartItems]);

  const parsedDiscount = Math.max(0, parseFloat(discount) || 0);
  const parsedDeliveryFee = Math.max(0, parseFloat(deliveryCharge) || 0);
  const grandTotal = Math.max(0, subtotal - parsedDiscount + parsedDeliveryFee);

  // Submit Order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter the customer full name.');
      return;
    }

    if (!societyStreet.trim()) {
      setError('Please enter Society/Street name in Halol.');
      return;
    }

    const finalArea = selectedArea === 'Other' ? customArea.trim() : selectedArea.split(' (')[0];
    if (!finalArea) {
      setError('Please select or specify the area in Halol.');
      return;
    }

    if (cartItems.length === 0) {
      setError('Please add at least one vegetable/fruit item to the order.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        customer_name: fullName.trim(),
        customer_mobile: mobile,
        customer_alternate_mobile: alternateMobile.trim() || undefined,
        flat_house_no: flatHouse.trim(),
        society_street_name: societyStreet.trim(),
        landmark: landmark.trim(),
        area_locality: finalArea,
        pincode: pincode.trim() || '389350',
        delivery_date: deliveryDate,
        delivery_slot_start: deliverySlot === 'morning' ? '06:00:00' : '16:00:00',
        delivery_slot_end: deliverySlot === 'morning' ? '10:00:00' : '20:00:00',
        payment_method: paymentMethod === 'cod' ? 'cod' : 'upi',
        channel: channel,
        special_instructions: specialInstructions.trim() || undefined,
        discount_amount: parsedDiscount,
        delivery_charge: parsedDeliveryFee,
        items: cartItems.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          custom_price: i.unit_price,
        })),
      };

      const res = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to create order');
      }

      setCreatedOrderData(json.data);
      if (onOrderCreated) {
        onOrderCreated(json.data);
      }
    } catch (err) {
      console.error('Order creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setMobile('');
    setFullName('');
    setAlternateMobile('');
    setIsExistingCustomer(false);
    setFlatHouse('');
    setSocietyStreet('');
    setLandmark('');
    setSelectedArea('Halol Town (હાલોલ ટાઉન)');
    setCustomArea('');
    setPincode('389350');
    setDeliveryDate(getTomorrowDate());
    setDeliverySlot('morning');
    setCartItems([]);
    setDiscount('0');
    setDeliveryCharge('0');
    setSpecialInstructions('');
    setError(null);
    setCreatedOrderData(null);
    setShowStickerPrint(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shadow-xs">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Direct / Phone Order Booking</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/20 text-emerald-100">
                  નવો ઓર્ડર ઉમેરો
                </span>
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                Create order directly for phone calls, WhatsApp bookings, or walk-ins
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {createdOrderData ? (
          /* SUCCESS STATE */
          <div className="p-8 text-center space-y-6 overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Order Confirmed Successfully (ઓર્ડર સફળતાપૂર્વક ઉમેરાયો)
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-1">
                {createdOrderData.order_number}
              </h3>
              <p className="text-sm text-slate-600">
                Customer: <strong>{createdOrderData.customer_name}</strong> &bull; {createdOrderData.customer_mobile}
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Delivery Date: <strong>{createdOrderData.delivery_date}</strong> &bull; Payable: <strong className="text-emerald-700">₹{createdOrderData.final_payable_amount}</strong> ({createdOrderData.total_items} items)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowStickerPrint(true)}
                className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bag Sticker (સ્ટીકર પ્રિન્ટ કરો)</span>
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Order (બીજો ઓર્ડર ઉમેરો)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="px-5 py-3 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                Done / Close
              </button>
            </div>

            {showStickerPrint && createdOrderData && (
              <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700">Thermal Packing Sticker</span>
                  <button
                    onClick={() => setShowStickerPrint(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Hide
                  </button>
                </div>
                <ThermalBagSticker
                  payload={{
                    header: 'SABJIWALA HALOL',
                    order_id: createdOrderData.order_id,
                    order_number: createdOrderData.order_number,
                    order_date: new Date().toISOString(),
                    bag_id: `bag-${createdOrderData.order_id}-1`,
                    bag_barcode: `SBJ-BAG-${createdOrderData.order_number}-01`,
                    bag_sequence: 1,
                    total_bags: 1,
                    customer_name: createdOrderData.customer_name,
                    customer_mobile: createdOrderData.customer_mobile || '',
                    delivery_date: createdOrderData.delivery_date,
                    delivery_slot: deliverySlot === 'morning' ? '06:00 AM - 10:00 AM' : '04:00 PM - 08:00 PM',
                    delivery_area: selectedArea,
                    delivery_society_street: societyStreet,
                    delivery_flat_house: flatHouse,
                    delivery_landmark: landmark,
                    payment_method: paymentMethod.toUpperCase(),
                    final_payable_amount: Number(createdOrderData.final_payable_amount || 0),
                    collect_cash_text: paymentMethod === 'cod' ? `₹${Number(createdOrderData.final_payable_amount || 0).toFixed(0)} COD` : 'PRE-PAID',
                    qr_token: createdOrderData.order_id,
                    qr_url: `https://sabjiwala.in/b/${createdOrderData.order_id}`,
                    printed_at: new Date().toISOString(),
                    items_summary: cartItems.map((i) => ({
                      name_en: i.product_name_en,
                      name_gu: i.product_name_gu,
                      variant_en: i.variant_name_en,
                      variant_gu: i.variant_name_gu,
                      qty: i.quantity,
                      unit: 'pack',
                      unit_price: i.unit_price,
                      line_total: i.line_total,
                    })),
                  }}
                />
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt / Sticker (પ્રિન્ટ પહોંચ)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* FORM ENTRY STATE */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
              
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. CUSTOMER INFORMATION */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Customer Details (ગ્રાહકની વિગત)</span>
                  </div>
                  {isExistingCustomer && (
                    <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full font-bold text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Existing Customer (જૂનો ગ્રાહક)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Mobile Number (મોબાઇલ નંબર) *
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit number"
                        value={mobile}
                        onChange={(e) => handleMobileChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        required
                      />
                      {lookingUpCustomer && (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600 absolute right-2.5 top-2.5" />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Customer Full Name (પૂરું નામ) *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rameshbhai Patel"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Alternate Mobile (બીજો મોબાઇલ)
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Optional"
                      value={alternateMobile}
                      onChange={(e) => setAlternateMobile(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. DELIVERY ADDRESS */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-wider text-[11px]">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Halol Delivery Address (સરનામું)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Flat / House / Room No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. B-402, Block A"
                      value={flatHouse}
                      onChange={(e) => setFlatHouse(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Society / Street / Colony *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Shivalik Residency"
                      value={societyStreet}
                      onChange={(e) => setSocietyStreet(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Landmark (લેન્ડમાર્ક)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Near Bus Stand"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Area in Halol (વિસ્તાર) *
                    </label>
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      {POPULAR_HALOL_AREAS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                      <option value="Other">Other / Custom Area</option>
                    </select>
                  </div>
                </div>

                {selectedArea === 'Other' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Specify Custom Area / Village near Halol *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter area name..."
                      value={customArea}
                      onChange={(e) => setCustomArea(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      required
                    />
                  </div>
                )}
              </div>

              {/* 3. DELIVERY SCHEDULE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <label className="font-black text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Delivery Date (ડિલિવરી તારીખ)</span>
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <label className="font-black text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Delivery Slot (સમય ગાળો)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliverySlot('morning')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                        deliverySlot === 'morning'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Morning 6-10 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliverySlot('evening')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                        deliverySlot === 'evening'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Evening 4-8 PM
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. ITEM SELECTION & BASKET */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    <span>Select Vegetables &amp; Fruits (શાકભાજી અને ફળો પસંદ કરો)</span>
                  </div>
                  <span className="text-slate-500 font-bold">
                    {cartItems.length} items in basket
                  </span>
                </div>

                {/* Catalog Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search potato, tomato, bhindi, safarchand, kothmir..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Quick Add Product Chips */}
                {loadingCatalog ? (
                  <div className="py-4 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-emerald-600" />
                    <span>Loading fresh catalog items...</span>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-slate-50/50">
                    {filteredCatalog.map((prod) => (
                      <div
                        key={prod.id}
                        className="bg-white border border-slate-200 p-2 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:border-emerald-300 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 text-[11px] truncate">
                            {prod.name_en} <span className="font-normal text-slate-500">({prod.name_gu})</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {prod.variants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => addItemToCart(prod, v)}
                                className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-800 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>{v.variant_name_en}</span>
                                <span className="font-extrabold">₹{v.selling_price}</span>
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredCatalog.length === 0 && (
                      <div className="col-span-full py-4 text-center text-slate-400">
                        No products match &quot;{productSearch}&quot;
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Basket Table */}
                {cartItems.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden mt-3">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Item (નામ)</th>
                          <th className="p-2.5">Pack (પેક)</th>
                          <th className="p-2.5 w-24">Rate (₹)</th>
                          <th className="p-2.5 w-28 text-center">Qty (જથ્થો)</th>
                          <th className="p-2.5 text-right">Total (₹)</th>
                          <th className="p-2.5 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
                        {cartItems.map((item) => (
                          <tr key={item.variant_id} className="hover:bg-slate-50/80">
                            <td className="p-2.5 font-bold">
                              {item.product_name_en} <span className="text-slate-400 font-normal">({item.product_name_gu})</span>
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {item.variant_name_en}
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-1">
                                <span>₹</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unit_price}
                                  onChange={(e) => updateItemPrice(item.variant_id, parseFloat(e.target.value) || 0)}
                                  className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded font-bold text-right font-mono"
                                />
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.variant_id, -1)}
                                  className="w-6 h-6 rounded bg-white hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 font-black font-mono text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.variant_id, 1)}
                                  className="w-6 h-6 rounded bg-white hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-black font-mono text-slate-900">
                              ₹{item.line_total.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(item.variant_id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 5. PAYMENT, CHARGES & SPECIAL INSTRUCTIONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Payment Option & Channel */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                  <div className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    Payment &amp; Booking Channel
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Payment Mode (ચૂકવણી)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                        className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                          paymentMethod === 'cod'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Cash on Delivery (COD)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('paid')}
                        className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                          paymentMethod === 'paid'
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Paid (UPI / Cash)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Booking Channel
                    </label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="phone_whatsapp">Phone Call / WhatsApp (ફોન અથવા વોટ્સએપ)</option>
                      <option value="manual_admin">Walk-In / Direct Staff Counter (રૂબરૂ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Special Note / Instructions
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Call before delivery, deliver fresh coriander"
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Final Bill Summary */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    Bill Summary (બિલ વિગત)
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Items Subtotal ({cartItems.length} items):</span>
                      <span className="font-mono font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Delivery Fee:</span>
                      <div className="flex items-center gap-1">
                        <span>₹</span>
                        <input
                          type="number"
                          min={0}
                          value={deliveryCharge}
                          onChange={(e) => setDeliveryCharge(e.target.value)}
                          className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-bold text-right font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Discount (ડિસ્કાઉન્ટ):</span>
                      <div className="flex items-center gap-1">
                        <span className="text-amber-700 font-bold">-₹</span>
                        <input
                          type="number"
                          min={0}
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-bold text-right font-mono text-amber-700"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                      <span>Final Net Payable:</span>
                      <span className="font-mono text-emerald-700 text-base">₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 bg-white p-2 rounded-xl border border-slate-200">
                    Order will be instantly marked <strong>Confirmed</strong> and queued for daily procurement &amp; packing.
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                disabled={submitting}
                className="px-4 py-2.5 rounded-2xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || cartItems.length === 0 || mobile.length !== 10 || !fullName.trim()}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Create &amp; Confirm Order (ઓર્ડર કન્ફર્મ કરો) &bull; ₹{grandTotal.toFixed(0)}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
