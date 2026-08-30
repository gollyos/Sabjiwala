'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Product, ProductVariant, Category } from '@/types/taji-tokri';
import { useCart } from '@/context/CartContext';
import { Clock, MapPin, ArrowRight, Leaf, Search, X, Apple, Salad, ChevronDown, HelpCircle, Truck, RotateCcw, Phone, MessageCircle, Sprout, IndianRupee } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { SlideRotator } from '@/components/ui/SlideRotator';
import { JourneyStepper } from '@/components/ui/JourneyStepper';

// Rotating marketing pitches for the hero — broader reasons to buy from Taji Tokri
// (the farm-to-home concept itself is already stated in the static headline),
// cycled in English, Gujarati & Hindi so every local customer understands them.
const HERO_SLIDE_PHRASES = [
  'Cheaper Than Local Market Price.',
  'બજાર કરતાં સસ્તા ભાવ.',
  'बाज़ार से भी सस्ता भाव.',
  '100% Free Home Delivery.',
  '100% મફત હોમ ડિલિવરી.',
  '100% फ्री होम डिलीवरी.',
  "Halol's Own Trusted Brand.",
  'હાલોલનો પોતાનો ભરોસાપાત્ર બ્રાન્ડ.',
  'आपके शहर का अपना भरोसेमंद ब्रांड.',
];

const HERO_USPS = [
  { icon: IndianRupee, labelGu: 'સસ્તા ભાવ', labelEn: 'Cheaper Than Market' },
  { icon: Truck, labelGu: 'મફત ડિલિવરી', labelEn: 'Free Home Delivery' },
  { icon: Sprout, labelGu: 'ખેતરથી તાજું', labelEn: 'Farm to Home Fresh' },
];

const STORE_PHONE = process.env.NEXT_PUBLIC_STORE_PHONE || '+917069131300';
const STORE_PHONE_DISPLAY = STORE_PHONE ? STORE_PHONE.replace('+91', '+91 ') : '';
// Frequently Asked Questions for Google SEO & Customer Guidance
const FAQS_DATA = [
  {
    qGu: 'ઓર્ડર આપવાનો છેલ્લો સમય (Cutoff Time) શું છે?',
    qEn: 'What is the daily order cutoff time for Halol delivery?',
    aGu: 'આવતીકાલની તાજી ડિલિવરી માટે ઓર્ડર સાંજે ૭:૫૦ (7:50 PM IST) પહેલાં કરવાનો રહેશે. ૭:૫૦ પછીના ઓર્ડર પરમદિવસે સવારે ડિલિવર થશે.',
    aEn: 'Orders placed before 7:50 PM IST are delivered the next morning. Orders placed after 7:50 PM are scheduled for day-after-tomorrow delivery.',
  },
  {
    qGu: 'ડિલિવરી ક્યારે મળે છે અને ટ્રેકિંગ કેવી રીતે થશે?',
    qEn: 'When will I receive my daily delivery and how do I track it?',
    aGu: 'ડિલિવરી સવારે ૧૦ થી બપોરે ૧ વાગ્યા વચ્ચે થાય છે. ઓર્ડર નીકળતાં જ તમને ટ્રેકિંગ અને ડિલિવરી અપડેટ્સ WhatsApp પર મોકલવામાં આવે છે.',
    aEn: 'Deliveries arrive in the 10:00 AM–1:00 PM window. Tracking and delivery updates are sent directly to your WhatsApp.',
  },
  {
    qGu: 'શું કેશ ઓન ડિલિવરી (COD) અને UPI ઉપલબ્ધ છે?',
    qEn: 'Which payment methods are accepted? Is Cash on Delivery (COD) available?',
    aGu: 'હા! હાલમાં કેશ ઓન ડિલિવરી (COD) અને ડિલિવરી સમયે UPI QR સ્કેન (Google Pay / PhonePe / Paytm) ઉપલબ્ધ છે. COD ઓર્ડર પર તમને ૨% વધારાનું ડિસ્કાઉન્ટ પણ મળે છે.',
    aEn: 'Yes! We support Cash on Delivery (COD) and UPI QR on Delivery (GPay/PhonePe). You also receive an instant 2% discount on COD orders.',
  },
  {
    qGu: 'FIRST500 ઑફર અને ૧૦% ડિસ્કાઉન્ટ કેવી રીતે મળશે?',
    qEn: 'How does the FIRST500 launch offer work?',
    aGu: 'કેમ્પેઇન સક્રિય હોય ત્યારે હાલોલના પ્રથમ ૫૦૦ વેરિફાઇડ ગ્રાહકોને તેમના પ્રથમ ૩ ઓર્ડર પર ૧૦% ડિસ્કાઉન્ટ ચેકઆઉટ પર આપોમેળે લાગુ થાય છે.',
    aEn: 'While the launch campaign is active, the first 500 verified Halol customers receive 10% off their first 3 orders automatically at checkout.',
  },
  {
    qGu: 'જો કોઈ શાકભાજી કે ફળ ખરાબ નીકળે તો શું કરવું? (Quality Guarantee)',
    qEn: 'What is Taji Tokri’s quality and replacement policy?',
    aGu: 'ડિલિવરી વખતે માલ ચકાસો. કોઈ વસ્તુ યોગ્ય ન લાગે તો તે ડિલિવરી પાર્ટનરને પરત આપી શકો છો; ટીમ તમારા પ્રશ્નનું યોગ્ય સમાધાન કરશે.',
    aEn: 'Inspect your produce at delivery. If an item is not acceptable, return it with the delivery partner and the team will resolve the affected item.',
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

type CatalogProductRow = Omit<Product, 'variants'> & {
  product_variants?: ProductVariant[];
};

export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const { openCartDrawer } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeModule, setActiveModule] = useState<'all' | 'vegetables' | 'fruits'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const loadCatalog = React.useCallback(async (isBackground = false) => {
    await Promise.resolve();
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
          is_in_stock,
          is_seasonal,
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
        const mappedProds: Product[] = (prodData as unknown as CatalogProductRow[]).map((p) => ({
          ...p,
          is_in_stock: p.is_in_stock !== false,
          variants: (p.product_variants || []).filter((v) => v.is_active !== false),
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

    // ⚡ Realtime subscription: Auto-update catalog when Admin toggles stock or updates pricing
    const channel = supabase
      .channel('public:catalog_live_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        loadCatalog(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, () => {
        loadCatalog(true);
      })
      .subscribe();

    // Auto-refresh when tab gains focus to show latest admin changes immediately
    const onFocus = () => loadCatalog(true);
    window.addEventListener('focus', onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadCatalog, supabase]);

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
  const isFruitProduct = React.useCallback((p: Product) => {
    const cat = categories.find((c) => c.id === p.category_id);
    const slug = cat?.slug || '';
    return slug.includes('fruit') || p.slug.includes('apple') || p.slug.includes('banana') || p.slug.includes('dadam') || p.slug.includes('pomegranate') || p.slug.includes('mosambi') || p.slug.includes('orange') || p.slug.includes('papaya') || p.slug.includes('guava') || p.slug.includes('watermelon') || p.slug.includes('chiku') || p.slug.includes('dragon');
  }, [categories]);

  // Filter Products with Smart Search & Modules + Stock-First Sorting
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = products.filter((p) => {
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

    // ⚡ Sort: In-Stock items FIRST, Out-of-Stock items LAST at the bottom
    return filtered.sort((a, b) => {
      const aInStock = a.is_in_stock !== false && (a.variants && a.variants.length > 0);
      const bInStock = b.is_in_stock !== false && (b.variants && b.variants.length > 0);

      // If stock status differs, available items come first
      if (aInStock && !bInStock) return -1;
      if (!aInStock && bInStock) return 1;

      // Secondary sort: display_order ascending, then name_en ascending
      const aOrder = a.display_order ?? 999;
      const bOrder = b.display_order ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return (a.name_en || '').localeCompare(b.name_en || '');
    });
  }, [products, activeModule, selectedCategory, searchQuery, isFruitProduct]);

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
    <div className="pb-28 sm:pb-16 bg-[#fbfcf7] dark:bg-[#07140f] min-h-screen text-slate-900 dark:text-slate-100">
      <section className="relative overflow-hidden border-b border-emerald-100/80 bg-[linear-gradient(160deg,#0e3d27_0%,#0f7a45_38%,#f6a94a_78%,#fdfaf2_100%)] dark:border-emerald-900 dark:bg-[linear-gradient(160deg,#071c12_0%,#0c3823_45%,#3c2a10_85%,#07140f_100%)]">
        <div className="absolute -right-16 -top-16 h-80 w-80 rounded-full bg-[#e0453a]/25 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-[#f6a94a]/25 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[24rem_1fr] lg:items-center lg:gap-12 lg:px-8 lg:py-20">
          {/* LEFT: the brand — big logo mark + name, the first thing anyone sees */}
          <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="absolute -inset-x-10 -inset-y-6 rounded-full bg-white/10 blur-3xl pointer-events-none lg:-inset-x-16" aria-hidden="true" />
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-4 ring-white/70 shadow-2xl sm:h-44 sm:w-44 lg:h-56 lg:w-56 xl:h-64 xl:w-64">
              <Image
                src="/logo.png"
                alt="Taji Tokri"
                width={256}
                height={256}
                sizes="(min-width: 1280px) 256px, (min-width: 1024px) 224px, (min-width: 640px) 176px, 112px"
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <p className="relative font-display mt-4 whitespace-nowrap text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Taji Tokri
            </p>
            <p lang="gu" className="relative font-display mt-1.5 whitespace-nowrap text-3xl font-bold text-[#ffe1ad] sm:text-4xl lg:text-5xl">તાજી ટોકરી</p>
          </div>

          {/* RIGHT: the pitch — core concept, farm-to-home journey, rotating marketing line, USPs, CTAs */}
          <div className="max-w-2xl">
            <h1 lang="gu" className="font-display text-2xl font-extrabold leading-[1.25] tracking-[-0.01em] text-white text-wrap-balance sm:text-4xl lg:text-5xl [text-shadow:0_2px_24px_rgb(0_0_0/0.18)]">
              દરરોજ તાજું અને બિલકુલ ફ્રેશ, સીધું ખેતરથી સીધા તમારા ઘર સુધી.
            </h1>
            <p className="mt-2 text-sm font-semibold text-emerald-50/90 sm:text-base">
              Fresh every day, straight from the farm to your door.
            </p>

            {/* Farm-to-home journey — auto-looping, like our delivery tracking */}
            <JourneyStepper className="mt-5 max-w-md sm:max-w-lg" />

            {/* Rotating marketing slide — premium, continuous, not just about produce */}
            <p className="mt-5 min-h-[1.5em] text-lg font-extrabold leading-tight text-[#ffe1ad] sm:text-xl lg:text-2xl [text-shadow:0_2px_24px_rgb(0_0_0/0.18)]">
              <SlideRotator phrases={HERO_SLIDE_PHRASES} />
            </p>

            {/* USP strip — bilingual (Gujarati + English), stretched into one even row */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {HERO_USPS.map(({ icon: Icon, labelGu, labelEn }) => (
                <span
                  key={labelEn}
                  className="flex flex-col items-center justify-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-2 text-center text-white backdrop-blur sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1.5"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[#ffe1ad] sm:h-4 sm:w-4" aria-hidden="true" />
                  <span lang="gu" className="text-[10px] font-extrabold leading-tight sm:text-sm">{labelGu}</span>
                  <span className="hidden font-normal text-white/80 sm:inline sm:text-sm">({labelEn})</span>
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href="#catalog" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ee8a2f_0%,#e0453a_100%)] px-6 py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgb(224_69_58/0.4)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto">
                Shop Today&rsquo;s Fresh Picks
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link href="/delivery-areas/halol" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/50 bg-white/10 px-5 py-3 text-sm font-extrabold text-white backdrop-blur transition-colors hover:bg-white/20 sm:w-auto">
                Check Your Delivery Area
              </Link>
            </div>

            {/* Compact delivery snapshot — replaces the old "Next Delivery" card with simple inline text */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/25 bg-white/10 px-2.5 py-2.5 text-center backdrop-blur">
                <Clock className="mx-auto h-4 w-4 text-[#ffe1ad]" aria-hidden="true" />
                <p className="mt-1 text-[11px] font-bold leading-tight text-white">7:50&nbsp;PM cutoff</p>
              </div>
              <div className="rounded-2xl border border-white/25 bg-white/10 px-2.5 py-2.5 text-center backdrop-blur">
                <IndianRupee className="mx-auto h-4 w-4 text-[#ffe1ad]" aria-hidden="true" />
                <p className="mt-1 text-[11px] font-bold leading-tight text-white">Free above ₹200</p>
              </div>
              <div className="rounded-2xl border border-white/25 bg-white/10 px-2.5 py-2.5 text-center backdrop-blur">
                <MapPin className="mx-auto h-4 w-4 text-[#ffe1ad]" aria-hidden="true" />
                <p className="mt-1 text-[11px] font-bold leading-tight text-white">Halol &amp; Baska</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-4 sm:space-y-5">
        <section id="catalog" className="scroll-mt-32">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Today’s Catalog</p>
              <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Choose Fresh. We&rsquo;ll Handle the Morning.</h2>
            </div>
            {!loading && <p className="hidden text-sm font-semibold text-slate-500 sm:block">{filteredProducts.length} items available</p>}
          </div>
        
        {/* Module Switcher Tabs: All / Vegetables / Fruits */}
        <div className="grid grid-cols-3 gap-1 p-1.5 bg-emerald-100/70 dark:bg-slate-900 border border-emerald-200/70 dark:border-slate-800 rounded-2xl max-w-md" role="group" aria-label="Product type">
          <button
            type="button"
            onClick={() => { setActiveModule('all'); setSelectedCategory('all'); }}
            aria-pressed={activeModule === 'all'}
            className={`min-h-10 py-2 px-1 rounded-xl font-extrabold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeModule === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-white'
            }`}
          >
            <span>All Items</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveModule('vegetables'); setSelectedCategory('all'); }}
            aria-pressed={activeModule === 'vegetables'}
            className={`min-h-10 py-2 px-1 rounded-xl font-extrabold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeModule === 'vegetables'
                ? 'bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-white'
            }`}
          >
            <Salad className="w-3.5 h-3.5 shrink-0" />
            <span>શાકભાજી (Veg)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveModule('fruits'); setSelectedCategory('all'); }}
            aria-pressed={activeModule === 'fruits'}
            className={`min-h-10 py-2 px-1 rounded-xl font-extrabold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeModule === 'fruits'
                ? 'bg-[linear-gradient(135deg,#ee8a2f_0%,#e0453a_100%)] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-[#ee8a2f] dark:hover:text-white'
            }`}
          >
            <Apple className="w-3.5 h-3.5 shrink-0" />
            <span>ફળો (Fruits)</span>
          </button>
        </div>

        {/* Search Bar (Blinkit Style with Quick Chips) */}
        <div className="mt-4 space-y-2">
          <div className="relative">
            <label htmlFor="catalog-search" className="sr-only">Search fruits and vegetables</label>
            <input
              id="catalog-search"
              name="catalog-search"
              type="text"
              autoComplete="off"
              placeholder="Search tomato, potato, સફરજન…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#0b1b14] border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-11 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-600 shadow-xs transition-[border-color,box-shadow] font-medium"
            />
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-4 top-4" aria-hidden="true" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                type="button"
                aria-label="Clear product search"
                className="absolute right-3.5 top-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Popular Quick Search Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <span className="text-slate-500 font-bold uppercase text-[10px] shrink-0 mr-1">Popular:</span>
            {POPULAR_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip.query}
                type="button"
                onClick={() => setSearchQuery(chip.query)}
                className="min-h-8 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0b1b14] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pill Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            aria-pressed={selectedCategory === 'all'}
            className={`min-h-10 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-white'
            }`}
          >
            All {activeModule === 'fruits' ? 'Fruits' : activeModule === 'vegetables' ? 'Vegetables' : 'Categories'}
          </button>

          {displayedCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              aria-pressed={selectedCategory === cat.id}
              className={`min-h-10 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] text-white shadow-xs'
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
        </section>

        {/* 🌟 SECTION 1: TRUST HIGHLIGHTS (Local APMC & Zero Plastic) */}
        <section className="pt-8 sm:pt-12">
          <div className="bg-[#0d3020] text-white rounded-[2rem] p-6 sm:p-8 border border-emerald-800/60 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#ee8a2f]/10 blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="absolute -left-10 -bottom-16 h-56 w-56 rounded-full bg-[#e0453a]/10 blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6">

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-emerald-50">Procured Against Real Orders</h3>
                  <p className="text-sm text-emerald-100/75 mt-1 leading-relaxed">
                    We close orders at 7:50&nbsp;PM and source overnight from Halol APMC, helping reduce storage time and unnecessary waste.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#ee8a2f]/20 border border-[#ee8a2f]/30 flex items-center justify-center text-[#f6a94a] shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-emerald-50">One Clear Delivery Window</h3>
                  <p className="text-sm text-emerald-100/75 mt-1 leading-relaxed">
                    Your basket is packed in the morning and delivered from 10&nbsp;AM–1&nbsp;PM, with order updates sent on WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#e0453a]/20 border border-[#e0453a]/30 flex items-center justify-center text-[#f28075] shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-emerald-50">Quality Checked at the Door</h3>
                  <p className="text-sm text-emerald-100/75 mt-1 leading-relaxed">
                    Inspect your produce during delivery. If an item is not acceptable, return it with the delivery partner for resolution.
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
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Taji Tokri Halol વિશે વધુ જાણો
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                હાલોલમાં તાજા ફળો અને શાકભાજીના ઓર્ડર અને ડિલિવરી અંગે સામાન્ય પ્રશ્નોના જવાબો.
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
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${idx}`}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span lang="gu" className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white block">
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
                      <div id={`faq-answer-${idx}`} className="px-4 pb-4 sm:px-5 sm:pb-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-sm text-slate-600 dark:text-slate-300 space-y-1.5 animate-in fade-in-50 duration-150">
                        <p lang="gu" className="leading-relaxed font-medium">{faq.aGu}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-normal">{faq.aEn}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* 🌿 CLEAN FOOTER: Brand, Contact & Halol Coverage */}
        <footer className="pt-10 pb-16 text-center space-y-5 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex justify-center">
            <BrandLogo size="lg" showGujarati={true} showTagline={true} asLink={false} />
          </div>

          {STORE_PHONE && (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <a
                href={`tel:${STORE_PHONE}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{STORE_PHONE_DISPLAY} (Call)</span>
              </a>
              <a
                href={`https://wa.me/${STORE_PHONE.replace(/\D/g, '')}?text=Halo%20Taji%20Tokri%20Support`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp સહાય (Help Desk)</span>
              </a>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Delivering daily across <strong>Halol &amp; Baska GIDC</strong> (389350)</span>
            </span>
            <span>•</span>
            <Link href="/delivery-areas/halol" className="text-emerald-600 dark:text-emerald-400 font-extrabold hover:underline">
              View Delivery Areas &amp; Timings &rarr;
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} Taji Tokri (તાજી ટોકરી) • Fresh Fruits &amp; Vegetables Delivered Daily in Halol, Gujarat.
          </p>
        </footer>

      </div>

    </div>
  );
}
