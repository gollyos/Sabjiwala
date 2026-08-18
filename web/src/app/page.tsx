'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Product, Category } from '@/types/sabjiwala';
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
  X
} from 'lucide-react';

export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const { cart, openCartDrawer, subtotal } = useCart();
  const { user, customer, isOnboarded, openAuthModal } = useAuth();

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

        // Fetch Products with active Variants
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
    <div className="pb-28 sm:pb-16 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* Clean Hero Banner */}
      <section className="bg-gradient-to-b from-emerald-800 to-teal-900 text-white relative overflow-hidden py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-3">
          
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Farm Fresh in Halol &bull; Order before 8 PM for 10 AM-1 PM delivery</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            તાજી શાકભાજી, રોજ સવારે <span className="text-emerald-300">તમારા ઘરઆંગણે</span>
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-xl">
            Directly sourced every night from APMC market and local farms. Sorted, packed with zero plastic waste, and delivered to your doorstep.
          </p>

          {/* Value Badges */}
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5 font-bold text-amber-300">
              <Tag className="w-3.5 h-3.5" />
              <span>FIRST500: 10% OFF</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5 font-bold text-emerald-200">
              <Clock className="w-3.5 h-3.5" />
              <span>Free Delivery on ₹200+</span>
            </div>
          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search fresh vegetables (ટામેટાં, બટાટા, કોબીજ...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs transition-all"
          />
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-4 top-3.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3 p-1 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pill Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            All Vegetables (બધી શાકભાજી)
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              {cat.name_gu} <span className="opacity-80 font-normal text-[11px]">({cat.name_en})</span>
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
                <div className="w-full h-36 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md w-3/4"></div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-md w-1/2"></div>
                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl w-full"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <div className="text-4xl">🥬</div>
            <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">No vegetables found</div>
            <p>Try searching for a different item name or resetting the category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

      </main>

      {/* Floating Bottom Cart Bar for Mobile */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-3 inset-x-3 sm:hidden z-40 animate-in slide-in-from-bottom-3 duration-200">
          <button
            onClick={openCartDrawer}
            className="w-full py-3.5 px-5 bg-emerald-600 active:scale-98 text-white rounded-2xl shadow-xl shadow-emerald-900/30 flex items-center justify-between font-bold text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>{totalCartCount} {totalCartCount === 1 ? 'item' : 'items'} &bull; ₹{subtotal.toFixed(0)}</span>
            </div>

            <div className="flex items-center gap-1 font-extrabold">
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

    </div>
  );
}
