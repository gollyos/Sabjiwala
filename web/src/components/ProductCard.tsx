'use client';

import React, { useState } from 'react';
import { Product, ProductVariant } from '@/types/sabjiwala';
import { useCart } from '@/context/CartContext';
import { Plus, Minus, AlertCircle } from 'lucide-react';
import { getDeliveryScheduleInfo } from '@/lib/deliveryHelper';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { cart, addToCart, updateQuantity } = useCart();
  const deliveryInfo = getDeliveryScheduleInfo();
  const variants = (product.variants || []).filter((v) => v.is_active !== false);

  const defaultVar = variants.find((v) => v.is_default) || variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string>(defaultVar?.id || '');

  // Always derive the latest live variant from product props so price changes reflect instantly
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || defaultVar;

  // Cart item calculation for selected variant
  const cartItem = selectedVariant 
    ? cart.find((item) => item.variant.id === selectedVariant.id)
    : undefined;
  const currentQty = cartItem?.quantity || 0;

  const isAvailable = product.is_in_stock && (selectedVariant ? selectedVariant.is_active !== false : false);

  const handleAdd = () => {
    if (selectedVariant && isAvailable) {
      addToCart(product, selectedVariant, 1);
    }
  };

  const handleIncrement = () => {
    if (selectedVariant && isAvailable) {
      updateQuantity(selectedVariant.id, currentQty + 1);
    }
  };

  const handleDecrement = () => {
    if (selectedVariant) {
      updateQuantity(selectedVariant.id, currentQty - 1);
    }
  };

  return (
    <div className={`group bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border shadow-xs transition-all duration-300 flex flex-col justify-between h-full min-w-0 relative isolate ${
      !isAvailable 
        ? 'border-slate-200 dark:border-slate-800 opacity-75' 
        : 'border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-700'
    }`}>
      
      {/* Top Image & Status Badges */}
      <div>
        <div className="relative w-full aspect-4/3 bg-slate-50 dark:bg-slate-950 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name_en}
              className={`w-full h-full object-cover transition-transform duration-500 ${
                isAvailable ? 'group-hover:scale-105' : 'grayscale'
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              🥬
            </div>
          )}

          {/* Fresh / Seasonal Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
            {isAvailable ? (
              <>
                <span className="px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-md text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold shadow-2xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Fresh Picked
                </span>
                {product.is_seasonal && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold shadow-2xs">
                    Seasonal
                  </span>
                )}
              </>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold shadow-2xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                Out of Stock
              </span>
            )}
          </div>

          {/* Selected Variant Price Badge */}
          {selectedVariant && isAvailable && (
            <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md text-white font-mono font-black text-xs shadow-sm z-10">
              ₹{Number(selectedVariant.selling_price).toFixed(0)}
            </div>
          )}
        </div>

        {/* Product Names & Pack Size Selector */}
        <div className="p-3.5 sm:p-4">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight truncate">
            {product.name_gu}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mb-2.5 truncate">
            {product.name_en}
          </p>

          {/* Pack Size Chips (Grams / Kg / Pcs) */}
          {variants.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pack Size (માપ)
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{v.variant_name_gu || v.variant_name_en}</span>
                      <span className="ml-1 opacity-80 font-mono font-normal">₹{Number(v.selling_price).toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3.5 sm:p-4 pt-0">
        {!isAvailable ? (
          <button
            disabled
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold rounded-2xl cursor-not-allowed"
          >
            Out of Stock (સ્ટોક ખલાસ)
          </button>
        ) : currentQty > 0 ? (
          <div className="w-full flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-1 shadow-2xs">
            <button
              onClick={handleDecrement}
              aria-label="Decrease quantity"
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center justify-center font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="text-center font-black text-emerald-950 dark:text-emerald-200 text-xs font-mono">
              {currentQty} in cart
            </div>
            <button
              onClick={handleIncrement}
              aria-label="Increase quantity"
              className="w-8 h-8 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-2xl shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add (ઉમેરો)</span>
          </button>
        )}

        {/* Dynamic Delivery Day Tag under every active product */}
        {isAvailable && (
          <div className="mt-2 text-center text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>ડિલિવરી: {deliveryInfo.labelShortGu} ({deliveryInfo.labelShortEn})</span>
          </div>
        )}
      </div>

    </div>
  );
}
