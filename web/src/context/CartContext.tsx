'use client';

import { getErrorMessage } from '@/lib/errors';




import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';
import { Product, ProductVariant, CartItem, CheckoutQuote } from '@/types/sabjiwala';
import { useAuth } from './AuthContext';
import { createClient } from '@/lib/supabase/client';

export interface OrderResult {
  order_id: string;
  order_number: string;
  subtotal: number;
  first_order_discount: number;
  cod_discount: number;
  final_payable_amount: number;
  order_status: string;
  payment_status: string;
  payment_method: string;
  delivery_date?: string | null;
  delivery_slot?: string | null;
  is_before_cutoff?: boolean | null;
  is_idempotent_replay?: boolean;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
    };
  }
}

interface CartContextType {
  cart: CartItem[];
  cartDrawerOpen: boolean;
  paymentMethod: 'cod' | 'online';
  isOnlinePaymentEnabled: boolean;
  serverQuote: CheckoutQuote | null;
  isLoadingQuote: boolean;
  isPlacingOrder: boolean;
  priceChangeAlert: string | null;
  orderError: string | null;
  orderSuccessData: OrderResult | null;
  minOrderAmount: number;
  subtotal: number;
  minimumOrderMet: boolean;
  remainingAmountToMinimum: number;
  first500Discount: number;
  codDiscount: number;
  paymentDiscount: number;
  deliveryCharge: number;
  finalPayable: number;
  hasUnavailableItems: boolean;
  specialInstructions: string;
  setPaymentMethod: (method: 'cod' | 'online') => void;
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  setSpecialInstructions: (notes: string) => void;
  mergeCartItems: (items: CartItem[]) => void;
  refreshQuote: () => Promise<void>;
  dismissPriceChangeAlert: () => void;
  placeOrder: () => Promise<{ success: boolean; data?: OrderResult; error?: string }>;
  closeOrderSuccessModal: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const { user, customer, defaultAddress, isOnboarded, openAuthModal } = useAuth();
  
  // Persistent local cart
  // Start with the same value on the server and the first browser render to
  // prevent hydration mismatches. Restore the saved basket after hydration.
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hasRestoredCart, setHasRestoredCart] = useState(false);

  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [isOnlinePaymentEnabled, setIsOnlinePaymentEnabled] = useState<boolean>(false);
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [serverQuote, setServerQuote] = useState<CheckoutQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [priceChangeAlert, setPriceChangeAlert] = useState<string | null>(null);
  const [orderSuccessData, setOrderSuccessData] = useState<OrderResult | null>(null);
  const prevQuoteTotalRef = useRef<number | null>(null);
  // One idempotency key per logical checkout attempt. It survives retries
  // (a network drop after order creation resumes the SAME pending order
  // instead of creating a duplicate) and only regenerates when the cart or
  // payment method changes. Cleared after a definitive success.
  const checkoutKeyRef = useRef<string | null>(null);
  const checkoutSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sabjiwala_cart');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        setCart(parsed as CartItem[]);
      }
    } catch {
      localStorage.removeItem('sabjiwala_cart');
    } finally {
      setHasRestoredCart(true);
    }
  }, []);

  // Sync changes only after the initial saved basket has been restored.
  useEffect(() => {
    if (hasRestoredCart) {
      localStorage.setItem('sabjiwala_cart', JSON.stringify(cart));
    }
  }, [cart, hasRestoredCart]);

  // Recalculate Authoritative Server-Side Quote
  const refreshQuote = useCallback(async () => {
    if (cart.length === 0) {
      setServerQuote(null);
      setPriceChangeAlert(null);
      prevQuoteTotalRef.current = null;
      return;
    }

    setIsLoadingQuote(true);
    try {
      const itemsPayload = cart.map((item) => ({
        variant_id: item.variant.id,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.rpc('calculate_checkout_quote', {
        p_items: itemsPayload,
        p_payment_method: paymentMethod,
      });

      if (error) {
        console.error('Error fetching server quote:', error);
        return;
      }

      const quote = data as CheckoutQuote;
      setServerQuote(quote);

      if (quote.payment.online_enabled !== undefined) {
        setIsOnlinePaymentEnabled(quote.payment.online_enabled);
      }

      // Check if price changed while items were in cart
      let priceChanged = false;
      quote.items.forEach((qItem) => {
        const localItem = cart.find((c) => c.variant.id === qItem.variant_id);
        if (localItem && localItem.variant.selling_price !== qItem.unit_price) {
          priceChanged = true;
        }
      });

      if (priceChanged) {
        setPriceChangeAlert('Some vegetable rates have updated from Halol APMC. Your cart total has been refreshed.');
      }

      prevQuoteTotalRef.current = quote.final_payable;
    } catch (err) {
      console.error('Failed to calculate quote:', err);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [cart, paymentMethod, supabase]);

  // Auto-refresh quote when cart, payment method, or auth state changes
  useEffect(() => {
    refreshQuote();
  }, [refreshQuote]);

  const addToCart = (product: Product, variant: ProductVariant, quantity: number = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.variant.id === variant.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        if (newQty <= 0) {
          return updated.filter((item) => item.variant.id !== variant.id);
        }
        updated[existingIndex].quantity = newQty;
        return updated;
      }
      return [...prev, { product, variant, quantity }];
    });
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.variant.id !== variantId);
      }
      return prev.map((item) =>
        item.variant.id === variantId ? { ...item, quantity } : item
      );
    });
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variant.id !== variantId));
  };

  // Merge externally-built items (e.g. Repeat Order) into the live cart.
  // Going through context — instead of writing localStorage directly — keeps
  // the provider state, persistence, and quote refresh in sync.
  const mergeCartItems = useCallback((items: CartItem[]) => {
    setCart((prev) => {
      const merged = [...prev];
      items.forEach((incoming) => {
        const quantity = Math.min(99, Math.max(1, Math.round(Number(incoming.quantity) || 1)));
        const idx = merged.findIndex((item) => item.variant.id === incoming.variant.id);
        if (idx > -1) {
          merged[idx] = { ...merged[idx], quantity: Math.min(99, merged[idx].quantity + quantity) };
        } else {
          merged.push({ ...incoming, quantity });
        }
      });
      return merged;
    });
  }, []);

  const clearCart = () => {
    setCart([]);
    setServerQuote(null);
    setPriceChangeAlert(null);
    setOrderError(null);
  };

  const openCartDrawer = () => {
    setCartDrawerOpen(true);
    setOrderError(null);
    refreshQuote();
  };

  const closeCartDrawer = () => setCartDrawerOpen(false);

  const dismissPriceChangeAlert = () => setPriceChangeAlert(null);
  const closeOrderSuccessModal = () => setOrderSuccessData(null);

  // Fallback calculations before server response
  const localSubtotal = cart.reduce((sum, item) => sum + item.variant.selling_price * item.quantity, 0);
  const subtotal = serverQuote ? serverQuote.subtotal : localSubtotal;
  const minOrderAmount = serverQuote ? serverQuote.minimum_order_amount : 200.00;
  const minimumOrderMet = serverQuote ? serverQuote.minimum_order_met : subtotal >= minOrderAmount;
  const remainingAmountToMinimum = serverQuote ? serverQuote.remaining_amount_to_minimum : Math.max(0, minOrderAmount - subtotal);
  const first500Discount = serverQuote ? serverQuote.promotion.discount_amount : 0.00;
  const codDiscount = paymentMethod === 'cod' ? (serverQuote ? serverQuote.payment.discount_amount : Math.round(subtotal * 0.02 * 100) / 100) : 0.00;
  const paymentDiscount = serverQuote ? serverQuote.payment.discount_amount : codDiscount;
  const deliveryCharge = serverQuote ? serverQuote.delivery.charge : 0.00;
  const finalPayable = serverQuote ? serverQuote.final_payable : Math.max(0, subtotal - first500Discount - paymentDiscount + deliveryCharge);
  const hasUnavailableItems = serverQuote ? serverQuote.has_unavailable_items : false;

  // Unified Order Placement Engine (COD vs Online)
  const placeOrder = async (): Promise<{ success: boolean; data?: OrderResult; error?: string }> => {
    if (!user || !isOnboarded || !customer) {
      openAuthModal();
      return { success: false, error: 'Please sign in with your phone OTP to place an order.' };
    }

    if (!defaultAddress) {
      return { success: false, error: 'Please select a delivery address in Halol before placing your order.' };
    }

    if (!minimumOrderMet) {
      const msg = `Minimum order amount is ₹${minOrderAmount.toFixed(0)}. Please add ₹${remainingAmountToMinimum.toFixed(0)} more.`;
      setOrderError(msg);
      return { success: false, error: msg };
    }

    if (hasUnavailableItems) {
      const msg = 'Some items in your cart are currently out of stock. Please adjust quantities.';
      setOrderError(msg);
      return { success: false, error: msg };
    }

    setIsPlacingOrder(true);
    setOrderError(null);

    try {
      // Reuse the key across retries of the same cart/payment combination so
      // the server-side idempotency check returns the original pending order.
      const signature = `${paymentMethod}|${cart
        .map((item) => `${item.variant.id}:${item.quantity}`)
        .sort()
        .join(',')}`;
      if (!checkoutKeyRef.current || checkoutSignatureRef.current !== signature) {
        checkoutKeyRef.current = `web-${paymentMethod}-${customer.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        checkoutSignatureRef.current = signature;
      }
      const idempotencyKey = checkoutKeyRef.current;
      
      const itemsPayload = cart.map((item) => ({
        variant_id: item.variant.id,
        quantity: item.quantity,
        expected_unit_price: item.variant.selling_price,
      }));

      // 1. Create internal order in Supabase
      const { data, error } = await supabase.rpc('create_customer_order', {
        p_customer_address_id: defaultAddress.id,
        p_payment_method: paymentMethod,
        p_items: itemsPayload,
        p_special_instructions: specialInstructions.trim() || null,
        p_idempotency_key: idempotencyKey,
        p_channel: 'web',
      });

      if (error) {
        console.error('Order creation error:', error);
        let errorMsg = error.message;
        if (error.message.includes('PRICE_CHANGED')) {
          errorMsg = error.message.replace('PRICE_CHANGED: ', '');
          setPriceChangeAlert(errorMsg);
          await refreshQuote();
        }
        setOrderError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const orderResult = data as OrderResult;

      // Case A: Cash on Delivery (Immediate confirmation)
      if (paymentMethod === 'cod') {
        checkoutKeyRef.current = null;
        // Trigger n8n webhook immediately in background
        if (orderResult?.order_id) {
          fetch('/api/automation/n8n-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderResult.order_id }),
          }).catch((err) => console.error('Failed to trigger n8n order webhook:', err));
        }

        clearCart();
        setCartDrawerOpen(false);
        setOrderSuccessData(orderResult);

        return { success: true, data: orderResult };
      }

      // Case B: Online Payment via Razorpay
      const rzpRes = await fetch('/api/payments/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderResult.order_id }),
      });

      const rzpData = await rzpRes.json();
      if (!rzpRes.ok || !rzpData.success) {
        throw new Error(rzpData.error || 'Failed to initialize online payment gateway.');
      }

      // Launch Razorpay Checkout Modal
      return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.Razorpay) {
          // Fallback if script loading delayed
          setOrderError('Payment gateway script loading. Please try again in a moment.');
          setIsPlacingOrder(false);
          resolve({ success: false, error: 'Razorpay SDK not loaded.' });
          return;
        }

        const rzp = new window.Razorpay({
          key: rzpData.key_id,
          amount: rzpData.amount_paise,
          currency: 'INR',
          name: 'TaazaTokra Halol',
          description: `Order ${orderResult.order_number} • Fresh Fruits & Vegetables`,
          order_id: rzpData.razorpay_order_id,
          prefill: rzpData.customer_prefill,
          theme: {
            color: '#059669', // Emerald-600
          },
          handler: async (response) => {
            try {
              // Server-side HMAC verification for immediate UX confirmation
              const verifyRes = await fetch('/api/payments/verify-signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: orderResult.order_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.success) {
                checkoutKeyRef.current = null;
                const confirmedResult: OrderResult = {
                  ...orderResult,
                  order_status: 'confirmed',
                  payment_status: 'completed',
                  payment_method: 'online',
                  delivery_date: verifyData.data.delivery_date,
                  delivery_slot: verifyData.data.delivery_slot || '10:00 AM – 01:00 PM',
                  is_before_cutoff: verifyData.data.is_before_cutoff,
                };
                // Trigger n8n webhook immediately in background
                if (orderResult?.order_id) {
                  fetch('/api/automation/n8n-trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderResult.order_id }),
                  }).catch((err) => console.error('Failed to trigger n8n order webhook:', err));
                }

                clearCart();
                setCartDrawerOpen(false);
                setOrderSuccessData(confirmedResult);

                resolve({ success: true, data: confirmedResult });
              } else {
                setOrderError(verifyData.error || 'Payment signature verification delayed. We are checking status.');
                resolve({ success: false, error: verifyData.error });
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? getErrorMessage(err) : 'Error confirming payment';
              console.error('Error verifying payment:', err);
              setOrderError(msg);
              resolve({ success: false, error: msg });
            } finally {
              setIsPlacingOrder(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsPlacingOrder(false);
              setOrderError('Payment attempt dismissed. You can retry paying for your order whenever ready.');
              resolve({ success: false, error: 'Payment dismissed by customer.' });
            },
          },
        });

        rzp.open();
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? getErrorMessage(err) : 'Failed to place order';
      console.error('Unexpected order placement error:', err);
      setOrderError(msg);
      // The online path returns a pending promise while the Razorpay modal is
      // open (it resets itself in its own callbacks), so reset here too —
      // otherwise the checkout button stays disabled forever when payment
      // initialization fails before the modal opens.
      setIsPlacingOrder(false);
      return { success: false, error: msg };
    } finally {
      if (paymentMethod === 'cod') {
        setIsPlacingOrder(false);
      }
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartDrawerOpen,
        paymentMethod,
        isOnlinePaymentEnabled,
        serverQuote,
        isLoadingQuote,
        isPlacingOrder,
        priceChangeAlert,
        orderError,
        orderSuccessData,
        minOrderAmount,
        subtotal,
        minimumOrderMet,
        remainingAmountToMinimum,
        first500Discount,
        codDiscount,
        paymentDiscount,
        deliveryCharge,
        finalPayable,
        hasUnavailableItems,
        specialInstructions,
        setPaymentMethod,
        mergeCartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        openCartDrawer,
        closeCartDrawer,
        setSpecialInstructions,
        refreshQuote,
        dismissPriceChangeAlert,
        placeOrder,
        closeOrderSuccessModal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
