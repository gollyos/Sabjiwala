'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Product, Category, ProductVariant } from '@/types/sabjiwala';
import { ProductCard } from '@/components/ProductCard';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
  Search, 
  Sparkles, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  ShoppingBag, 
  Tag, 
  ArrowRight,
  CheckCircle2,
  PhoneCall
} from 'lucide-react';

export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const { cart, openCartDrawer, subtotal } = useCart();
  const { user, customer, isOnboarded, openAuthModal, verifiedSequence } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoading(true);
        // Fetch Categories
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        // Fetch Products with active Variants (both in-stock and out-of-stock active products)
        const { data: prodData } = await supabase
          .from('products')
          .select('*, product_variants(*)')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (catData) setCategories(catData as Category[]);
        if (prodData) {
          const mappedProds: Product[] = prodData.map((p: any) => ({
            ...p,
            variants: (p.product_variants || []).filter((v: any) => v.is_active),
          }));
          setProducts(mappedProds);
        }
      } catch (err) {
        console.error('Error loading catalog:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, [supabase]);

  // Filter Products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesQuery = 
      !searchQuery.trim() ||
      p.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_gu.includes(searchQuery);
    return matchesCategory && matchesQuery;
  });

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="pb-24 sm:pb-16">
      
      {/* Hero Launch Banner */}
      <section className="bg-gradient-to-br from-emerald-800 via-teal-800 to-emerald-900 text-white relative overflow-hidden py-10 sm:py-16">
        {/* Background glow ornaments */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-emerald-200">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Halol&apos;s First Farm-to-Door Delivery Service</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                તાજી શાકભાજી, રોજ સવારે <br className="hidden sm:inline" />
                <span className="text-emerald-300">તમારા ઘરઆંગણે</span> • Halol
              </h1>

              <p className="text-sm sm:text-base text-emerald-100/90 max-w-2xl leading-relaxed">
                Directly sourced from Halol APMC & local Panchmahal farms every night. Hand-graded, zero-contact packed, and delivered right to your kitchen.
              </p>

              {/* Value Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    FIRST 500 OFFER
                  </div>
                  <div className="text-white/80 mt-0.5">10% OFF first order</div>
                </div>

                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs">
                  <div className="font-bold text-emerald-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    8:00 PM CUTOFF
                  </div>
                  <div className="text-white/80 mt-0.5">Next day 10 AM-1 PM</div>
                </div>

                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs col-span-2 sm:col-span-1">
                  <div className="font-bold text-teal-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    2% COD DISCOUNT
                  </div>
                  <div className="text-white/80 mt-0.5">Instant savings on COD</div>
                </div>
              </div>
            </div>

            {/* Right Card: Quick User Verification / Welcome */}
            <div className="lg:col-span-4">
              <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl text-white space-y-4">
                {user && isOnboarded && customer ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xl shadow-md">
                        {customer.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs text-emerald-200">Welcome Back</div>
                        <div className="font-bold text-base">{customer.full_name}</div>
                      </div>
                    </div>

                    {verifiedSequence && (
                      <div className="p-3 rounded-xl bg-amber-400/20 border border-amber-300/40 text-xs text-amber-200">
                        ⭐ Verified Customer <strong>#{verifiedSequence}</strong> in Halol
                      </div>
                    )}

                    <button
                      onClick={openCartDrawer}
                      className="w-full py-3 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>View Basket ({totalCartCount})</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                      🎁
                    </div>
                    <div>
                      <h3 className="font-bold text-base">New Customer in Halol?</h3>
                      <p className="text-xs text-emerald-100/80 mt-1">
                        Sign in with your phone number to claim 10% off your first order!
                      </p>
                    </div>

                    <button
                      onClick={() => openAuthModal()}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg"
                    >
                      <span>Sign In with Phone OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Main Catalog Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          
          {/* Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search vegetables (બટાટા, ટામેટા, Onion...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Items (બધું શાકભાજી)
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat.name_gu} ({cat.name_en})
              </button>
            ))}
          </div>

        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="bg-white rounded-3xl h-72 animate-pulse border border-slate-100 p-4 space-y-4">
                <div className="w-full h-36 bg-slate-100 rounded-2xl"></div>
                <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded-full w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-100 p-8 shadow-xs">
            <div className="text-4xl">🥬</div>
            <h3 className="font-bold text-lg text-slate-800">No Vegetables Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn&apos;t find any items matching &quot;{searchQuery}&quot;. Try searching in English or Gujarati.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        )}

      </section>

      {/* Floating Bottom Bar on Mobile */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 sm:hidden">
          <button
            onClick={openCartDrawer}
            className="w-full p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl shadow-2xl flex items-center justify-between font-bold text-sm border border-emerald-400/30 active:scale-98 transition-all"
          >
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs">
                {totalCartCount}
              </span>
              <span>View Basket</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>₹{subtotal.toFixed(0)}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

    </div>
  );
}
