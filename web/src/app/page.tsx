'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  X,
  Apple,
  Salad,
  Sparkle,
  ChevronDown,
  HelpCircle,
  Leaf,
  Truck,
  RotateCcw
} from 'lucide-react';

// Frequently Asked Questions for Google SEO & Customer Guidance
const FAQS_DATA = [
  {
    qGu: 'ઓર્ડર આપવાનો છેલ્લો સમય (Cutoff Time) શું છે?',
    qEn: 'What is the daily order cutoff time for Halol delivery?',
    aGu: 'તમે દરરોજ રાત્રે ૮:૦૦ વાગ્યા (8:00 PM) સુધી ઓર્ડર આપી શકો છો. રાત્રે ૮:૦૦ વાગ્યા પછી અમારી ટીમ APMC માર્કેટ અને સ્થાનિક ખેડૂતો પાસેથી સીધા જ તાજા શાકભાજી અને ફળો મેળવી સવારે તમારા ઘરે પહોંચાડે છે.',
    aEn: 'Orders are accepted until 8:00 PM every night. Sourced fresh at midnight from APMC and delivered right to your doorstep next morning.',
  },
  {
    qGu: 'ડિલિવરી ક્યારે અને કેટલા વાગ્યે મળે છે?',
    qEn: 'When will I receive my daily vegetable delivery in Halol?',
    aGu: 'બધા જ ઓર્ડર સવારે ૧૦:૦૦ થી બપોરે ૧:૦૦ વાગ્યા (10:00 AM - 1:00 PM Slot) વચ્ચે તમારા ઘરે સુરક્ષિત કોટન/જૂટ બેગમાં ડિલિવર કરવામાં આવે છે.',
    aEn: 'All deliveries arrive fresh at your doorstep between 10:00 AM - 1:00 PM every day in eco-friendly reusable cotton bags.',
  },
  {
    qGu: 'શું કેશ ઓન ડિલિવરી (COD) અને UPI ઉપલબ્ધ છે?',
    qEn: 'Which payment methods are accepted? Is Cash on Delivery (COD) available?',
    aGu: 'હા! હાલમાં કેશ ઓન ડિલિવરી (COD) અને ડિલિવરી સમયે UPI QR સ્કેન (Google Pay / PhonePe / Paytm) ઉપલબ્ધ છે. COD ઓર્ડર પર તમને ૨% વધારાનું ડિસ્કાઉન્ટ પણ મળે છે.',
    aEn: 'Yes! We support Cash on Delivery (COD) and UPI QR on Delivery (GPay/PhonePe). You also receive an instant 2% discount on COD orders.',
  },
  {
    qGu: 'FIRST500 ઑફર અને ૧૦% ડિસ્કાઉન્ટ કેવી રીતે મળશે?',
    qEn: 'How does the FIRST500 offer work for new customers?',
    aGu: 'હાલોલના પ્રથમ ૫૦૦ વેરિફાઇડ ગ્રાહકો માટે તેમના પ્રથમ સફળ ઓર્ડર પર ફ્લેટ ૧૦% ડિસ્કાઉન્ટ (Flat 10% OFF with FIRST500) આપમેળે ચેકઆઉટ પર લાગુ થઈ જાય છે.',
    aEn: 'The first 500 verified customers in Halol automatically receive flat 10% OFF on their first order using code FIRST500.',
  },
  {
    qGu: 'જો કોઈ શાકભાજી કે ફળ ખરાબ નીકળે તો શું કરવું? (Quality Guarantee)',
    qEn: 'What is Sabjiwala’s quality and replacement policy?',
    aGu: 'અમે ૧૦૦% નો-ક્વેશ્ચન રિપ્લેસમેન્ટ ગેરંટી આપીએ છીએ. જો કોઈ શાકભાજી કે ફળ તમારી અપેક્ષા મુજબ ન હોય, તો ડિલિવરી બોયને તરત પરત આપી શકો છો અથવા ૧-ક્લિકમાં વૉટ્સએપ પર જણાવતાં જ તેટલી રકમનું રિફંડ મળી જાય છે.',
    aEn: 'We offer 100% No-Questions-Asked replacement and instant refund guarantee if any item does not meet your quality expectations.',
  },
  {
    qGu: 'હાલોલમાં કયા કયા વિસ્તારોમાં ડિલિવરી મળે છે?',
    qEn: 'Which areas in Halol & Panchmahal do you deliver to?',
    aGu: 'અમે હાલોલ સિટી, બાસ્કા જીઆઈડીસી (Baska GIDC), પાવાગઢ રોડ, ગોધરા રોડ, કંજરી રોડ, રાધે શ્યામ સોસાયટી, અને વડોદરા હાઇવે આસપાસના તમામ વિસ્તારોમાં ડિલિવરી કરીએ છીએ.',
    aEn: 'We deliver across Halol Town, Baska GIDC, Pavagadh Bypass, Godhra Road, Kanjari Road, and all surrounding residential colonies.',
  },
];

// Phonetic search dictionary for Halol local terms
const SEARCH_SYNONYMS: Record<string, string[]> = {
  apple: ['safarchand', 'safarchant', 'સફરજન', 'apple', 'seb'],
  banana: ['kela', 'keda', 'kelaa', 'કેળાં', 'banana'],
  tomato: ['tameta', 'tametaa', 'tamatar', 'ટામેટા', 'tomato'],
  potato: ['batata', 'bataka', 'aaloo', 'aalu', 'બટાટા', 'potato'],
  onion: ['dungri', 'dungli', 'pyaaz', 'pyaz', 'ડુંગળી', 'onion'],
  pomegranate: ['dadam', 'daadam', 'anar', 'દાડમ', 'pomegranate'],
  mosambi: ['mosambi', 'musambi', 'sweet lime', 'મોસંબી'],
  orange: ['santra', 'santru', 'narangi', 'સંતરા', 'orange'],
  papaya: ['papaiyu', 'papita', 'પપૈયું', 'papaya'],
  guava: ['jamrukh', 'amrood', 'amrud', 'જામફળ', 'guava'],
  watermelon: ['tarbuch', 'tarbuj', 'kalind', 'તરબૂચ', 'watermelon'],
  bhindi: ['bhinda', 'okra', 'ladyfinger', 'ભીંડા', 'bhindi'],
  palak: ['spinach', 'palakh', 'પાલક', 'palak'],
  dudhi: ['bottle gourd', 'lauki', 'દૂધી', 'dudhi'],
  coriander: ['kothmir', 'dhaniya', 'કોથમીર', 'coriander'],
  chilli: ['marcha', 'mirchi', 'green chilli', 'મરચાં', 'chilli'],
  dragon: ['kamalam', 'dragon fruit', 'કમલમ', 'dragon'],
};

const POPULAR_SEARCH_CHIPS = [
  { label: '🍎 Apple (સફરજન)', query: 'apple' },
  { label: '🍌 Banana (કેળાં)', query: 'banana' },
  { label: '🍅 Tomato (ટામેટા)', query: 'tomato' },
  { label: '🥔 Potato (બટાટા)', query: 'potato' },
  { label: '🧅 Onion (ડુંગળી)', query: 'onion' },
  { label: '🍇 Dadam (દાડમ)', query: 'dadam' },
  { label: '🌿 Palak (પાલક)', query: 'palak' },
  { label: '🍉 Watermelon (તરબૂચ)', query: 'watermelon' },
];

export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const { cart, openCartDrawer, subtotal } = useCart();
  const { user, customer, isOnboarded, openAuthModal } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeModule, setActiveModule] = useState<'all' | 'vegetables' | 'fruits'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const loadCatalog = React.useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      // Fetch Categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      // Fetch Products with active Variants (safe public columns only)
      const { data: prodData } = await supabase
        .from('products')
        .select(`
          id,
          category_id,
          name_en,
          name_gu,
          slug,
          image_url,
          description_en,
          description_gu,
          display_order,
          is_active,
          product_variants (
            id,
            product_id,
            unit_id,
            sku,
            variant_name_en,
            variant_name_gu,
            multiplier_to_base_unit,
            selling_price,
            min_order_qty,
            max_order_qty,
            is_default,
            is_active,
            display_order
          )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (catData) setCategories(catData as Category[]);
      if (prodData) {
        const mappedProds: Product[] = (prodData as any[]).map((p: any) => ({
          ...p,
          variants: (p.product_variants || []).filter((v: any) => v.is_active),
        }));
        setProducts(mappedProds);
      }
    } catch (err) {
      console.error('Error loading catalog:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCatalog();

    // Auto-refresh when tab gains focus to show latest admin prices immediately
    const onFocus = () => loadCatalog(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadCatalog]);

  // Handle open_cart query parameter from repeat order or navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('open_cart') === 'true') {
        openCartDrawer();
      }
    }
  }, [openCartDrawer]);

  // Determine if a product is a fruit vs vegetable
  const isFruitProduct = (p: Product) => {
    const cat = categories.find((c) => c.id === p.category_id);
    const slug = cat?.slug || '';
    return slug.includes('fruit') || p.slug.includes('apple') || p.slug.includes('banana') || p.slug.includes('dadam') || p.slug.includes('mosambi') || p.slug.includes('orange') || p.slug.includes('papaya') || p.slug.includes('guava') || p.slug.includes('watermelon') || p.slug.includes('dragon');
  };

  // Filter Products with Smart Search & Modules
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      // 1. Module filter (All vs Vegetables vs Fruits)
      const isFruit = isFruitProduct(p);
      if (activeModule === 'fruits' && !isFruit) return false;
      if (activeModule === 'vegetables' && isFruit) return false;

      // 2. Specific Category pill filter
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) {
        return false;
      }

      // 3. Search query filter (Multi-lingual & Phonetic)
      if (!q) return true;

      const nameEn = (p.name_en || '').toLowerCase();
      const nameGu = p.name_gu || '';
      const slug = (p.slug || '').toLowerCase();
      const descEn = (p.description_en || '').toLowerCase();

      if (nameEn.includes(q) || nameGu.includes(q) || slug.includes(q) || descEn.includes(q)) {
        return true;
      }

      // Check synonyms mapping
      for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
        const matchesQuery = synonyms.some((s) => s.includes(q) || q.includes(s));
        const matchesProduct = nameEn.includes(key) || slug.includes(key) || synonyms.some((s) => nameGu.includes(s));
        if (matchesQuery && matchesProduct) return true;
      }

      return false;
    });
  }, [products, categories, activeModule, selectedCategory, searchQuery]);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Filtered categories based on active module
  const displayedCategories = useMemo(() => {
    if (activeModule === 'fruits') {
      return categories.filter((c) => c.slug.includes('fruit'));
    }
    if (activeModule === 'vegetables') {
      return categories.filter((c) => !c.slug.includes('fruit'));
    }
    return categories;
  }, [categories, activeModule]);

  return (
    <div className="pb-28 sm:pb-16 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* Clean Hero Banner */}
      <section className="bg-gradient-to-b from-emerald-800 via-teal-900 to-emerald-950 text-white relative overflow-hidden py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-3">
          
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Farm Fresh in Halol • Daily Morning 10 AM – 1 PM Delivery</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            તાજાં ફળો અને શાકભાજી, રોજ સવારે <span className="text-emerald-300">તમારા ઘરઆંગણે</span>
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-xl">
            Sourced every night from APMC market & local orchards. Premium grade fruits, farm-fresh vegetables, zero plastic packing.
          </p>

          {/* Value Badges */}
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5 font-bold text-amber-300">
              <Tag className="w-3.5 h-3.5" />
              <span>FIRST500: 10% OFF on First 3 Orders</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5 font-bold text-emerald-200">
              <Clock className="w-3.5 h-3.5" />
              <span>Free Delivery on ₹200+</span>
            </div>
          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        
        {/* Module Switcher Tabs: All / Vegetables / Fruits */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 rounded-2xl max-w-md">
          <button
            type="button"
            onClick={() => { setActiveModule('all'); setSelectedCategory('all'); }}
            className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeModule === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/60'
            }`}
          >
            <span>All Items (બધાં)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveModule('vegetables'); setSelectedCategory('all'); }}
            className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeModule === 'vegetables'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/60'
            }`}
          >
            <Salad className="w-3.5 h-3.5" />
            <span>શાકભાજી (Veg)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveModule('fruits'); setSelectedCategory('all'); }}
            className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeModule === 'fruits'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:text-amber-500 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/60'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>ફળો (Fruits)</span>
          </button>
        </div>

        {/* Search Bar (Blinkit Style with Quick Chips) */}
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search fruits & vegetables (સફરજન, ટામેટાં, કેળાં, બટાટા, દાડમ...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-10 py-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs transition-all font-medium"
            />
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-4 top-4" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Popular Quick Search Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <span className="text-slate-400 font-bold uppercase text-[9px] shrink-0 mr-1">Trending:</span>
            {POPULAR_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip.query}
                type="button"
                onClick={() => setSearchQuery(chip.query)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shrink-0 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pill Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-white'
            }`}
          >
            All {activeModule === 'fruits' ? 'Fruits' : activeModule === 'vegetables' ? 'Vegetables' : 'Categories'}
          </button>

          {displayedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-white'
              }`}
            >
              {cat.name_gu} <span className="opacity-80 font-normal text-[11px]">({cat.name_en})</span>
            </button>
          ))}
        </div>

        {/* Search Results Summary */}
        {searchQuery && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Showing <strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'item' : 'items'} for &quot;{searchQuery}&quot;</span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-emerald-600 font-bold hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}

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
            <div className="text-4xl">🍎🥦</div>
            <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">No items found</div>
            <p>Try searching with a different name (e.g. &quot;Safarchand&quot;, &quot;Tameta&quot;, &quot;Apple&quot;, &quot;Kela&quot;).</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 items-stretch auto-rows-fr">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* 🌟 SECTION 1: TRUST HIGHLIGHTS (Local APMC & Zero Plastic) */}
        <section className="pt-8 sm:pt-12">
          <div className="bg-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-emerald-800/60 shadow-xl relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
              
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-100">૧૦૦% તાજી રોજિંદી ખરીદી</h3>
                  <p className="text-xs text-emerald-300/80 mt-0.5 leading-relaxed">
                    રોજ રાત્રે APMC મંડીમાંથી સીધા જ ચૂંટેલા તાજા શાકભાજી અને ફળો. કોઈ કોલ્ડ સ્ટોરેજ કે વાસી માલ નહીં.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-100">સવારે ૬ થી ૯ મોર્નિંગ ડિલિવરી</h3>
                  <p className="text-xs text-emerald-300/80 mt-0.5 leading-relaxed">
                    રાત્રે ૮ વાગ્યા સુધી ઓર્ડર કરો અને સવારની ચા-નાસ્તા સાથે તાજા શાકભાજી તમારા દરવાજે મેળવો.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-100">૧૦૦% ક્વોલિટી રિપ્લેસમેન્ટ</h3>
                  <p className="text-xs text-emerald-300/80 mt-0.5 leading-relaxed">
                    જો કોઈ વસ્તુ પસંદ ન આવે, તો ડિલિવરી બોયને તરત પરત આપી શકો છો અથવા ઇન્સ્ટન્ટ રિફંડ મેળવી શકો છો.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ❓ SECTION 2: FREQUENTLY ASKED QUESTIONS (Google SEO Ranking FAQs) */}
        <section id="faqs" className="pt-6 sm:pt-10 pb-4">
          <div className="space-y-4">
            
            <div className="text-center max-w-2xl mx-auto space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>વારંવાર પૂછાતા પ્રશ્નો (FAQs)</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                સબ્જીવાલા હાલોલ વિશે વધુ જાણો
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                હાલોલ અને બાસ્કામાં શાકભાજી અને ફળોના ઓર્ડર અને ડિલિવરી અંગે સામાન્ય પ્રશ્નોના જવાબો.
              </p>
            </div>

            <div className="space-y-2.5 max-w-3xl mx-auto pt-2">
              {FAQS_DATA.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white block">
                          {faq.qGu}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-normal">
                          {faq.qEn}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                          isOpen ? 'rotate-180 text-emerald-600' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 animate-in fade-in-50 duration-150">
                        <p className="leading-relaxed font-medium">{faq.aGu}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-normal">{faq.aEn}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* 📍 SECTION 3: HALOL LOCAL AREA KEYWORD CLOUD (SEO Ranking Signals) */}
        <section className="pt-6 pb-12 text-center space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Halol & Panchmahal Service Locations (ડિલિવરી વિસ્તાર)
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-3xl mx-auto">
            {['Halol Town (હાલોલ શહેર)', 'Baska GIDC (બાસ્કા)', 'Pavagadh Road', 'Godhra Highway', 'Kanjari Road', 'Vadodara Bypass', 'Radhe Shyam Society', 'Gokul Dham', 'Gayatri Nagar'].map((loc, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium">
                📍 {loc}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 pt-2">
            © {new Date().getFullYear()} સબ્જીવાલા • Sabjiwala Halol. Farm Fresh Produce Delivered Daily.
          </p>
        </section>

      </main>

      {/* Floating Bottom Cart Bar for Mobile */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-16 inset-x-3 sm:hidden z-40 animate-in slide-in-from-bottom-3 duration-200">
          <button
            onClick={openCartDrawer}
            className="w-full py-3.5 px-5 bg-emerald-600 active:scale-98 text-white rounded-2xl shadow-xl shadow-emerald-900/30 flex items-center justify-between font-bold text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>{totalCartCount} {totalCartCount === 1 ? 'item' : 'items'} • ₹{subtotal.toFixed(0)}</span>
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

