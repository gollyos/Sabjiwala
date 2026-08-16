'use client';

import React, { useState } from 'react';
import { Product, ProductVariant } from '@/types/sabjiwala';
import { useCart } from '@/context/CartContext';
import { Plus, Minus, ShoppingBag, AlertCircle } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { cart, addToCart, updateQuantity } = useCart();
  const variants = (product.variants || []).filter((v) => v.is_active !== false);

  const defaultVar = variants.find((v) => v.is_default) || variants[0];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(defaultVar);

  if (!selectedVariant && variants.length > 0) {
    setSelectedVariant(variants[0]);
  }

  // Cart item calculation
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
    <div className={`group relative bg-white rounded-3xl overflow-hidden border shadow-sm transition-all duration-300 flex flex-col justify-between ${
      !isAvailable 
        ? 'border-slate-200 opacity-80' 
        : 'border-slate-100 hover:shadow-xl hover:border-emerald-200'
    }`}>
      
      {/* Top Image & Status Badges */}
      <div>
        <div className="relative w-full h-44 sm:h-52 bg-slate-50 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name_en}
              className={`w-full h-full object-cover transition-transform duration-500 ${
                isAvailable ? 'group-hover:scale-105' : 'grayscale'
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              🥬
            </div>
          )}

          {/* Fresh / Seasonal / Out of Stock Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {isAvailable ? (
              <>
                <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-emerald-800 text-[11px] font-bold shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Fresh Picked
                </span>
                {product.is_seasonal && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm">
                    Seasonal
                  </span>
                )}
              </>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold shadow-sm flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Out of Stock (સ્ટોક ખલાસ)
              </span>
            )}
          </div>

          {/* Current Selling Price Badge */}
          {selectedVariant && isAvailable && (
            <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-2xl bg-slate-950/85 backdrop-blur-md text-white font-extrabold text-sm shadow-md flex items-center gap-1">
              <span>₹{Number(selectedVariant.selling_price).toFixed(0)}</span>
            </div>
          )}
        </div>

        {/* Product Names & Descriptions */}
        <div className="p-4 sm:p-5">
          <h3 className="font-extrabold text-lg text-slate-900 leading-tight">
            {product.name_gu}
          </h3>
          <p className="text-xs font-semibold text-slate-500 mb-3">
            {product.name_en}
          </p>

          {/* Variant Selector */}
          {variants.length > 0 ? (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Pack Size (માપ)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{v.variant_name_gu || v.variant_name_en}</span>
                      <span className="ml-1 opacity-90 font-medium">₹{Number(v.selling_price).toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">Standard pack</div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 sm:p-5 pt-0">
        {!isAvailable ? (
          <button
            disabled
            className="w-full py-3.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-2xl cursor-not-allowed border border-slate-200"
          >
            Currently Unavailable (હાલમાં ઉપલબ્ધ નથી)
          </button>
        ) : currentQty > 0 ? (
          <div className="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl p-1 shadow-sm">
            <button
              onClick={handleDecrement}
              aria-label="Decrease quantity"
              className="w-10 h-10 rounded-xl bg-white text-emerald-700 hover:bg-emerald-100 flex items-center justify-center font-bold transition-all shadow-xs cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="text-center font-extrabold text-emerald-950 text-sm">
              <span>{currentQty} in cart</span>
            </div>
            <button
              onClick={handleIncrement}
              aria-label="Increase quantity"
              className="w-10 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-sm font-bold rounded-2xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Add to Cart (ઉમેરો)</span>
          </button>
        )}
      </div>

    </div>
  );
}
