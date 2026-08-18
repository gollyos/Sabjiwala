'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Product, ProductVariant, Category, ProductUnit } from '@/types/sabjiwala';
import { AdminNav } from '@/components/AdminNav';
import { 
  Package, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  Image as ImageIcon, 
  Upload, 
  Layers, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Trash2, 
  Tag, 
  Eye, 
  EyeOff, 
  Search, 
  Zap,
  Save
} from 'lucide-react';

export default function AdminProductsPage() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodBaseUnitId, setProdBaseUnitId] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodNameEn, setProdNameEn] = useState('');
  const [prodNameGu, setProdNameGu] = useState('');
  const [prodDescEn, setProdDescEn] = useState('');
  const [prodDescGu, setProdDescGu] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodIsSeasonal, setProdIsSeasonal] = useState(false);
  const [prodIsInStock, setProdIsInStock] = useState(true);
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodDisplayOrder, setProdDisplayOrder] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Fast Add Mode (Auto creates 250g, 500g, 1kg variants)
  const [fastAddPrice1kg, setFastAddPrice1kg] = useState<number>(40);
  const [isFastAdd, setIsFastAdd] = useState<boolean>(true);

  // Variant Modal State
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [varUnitId, setVarUnitId] = useState('');
  const [varSku, setVarSku] = useState('');
  const [varNameEn, setVarNameEn] = useState('');
  const [varNameGu, setVarNameGu] = useState('');
  const [varMultiplier, setVarMultiplier] = useState(1.0);
  const [varSellingPrice, setVarSellingPrice] = useState(0.0);
  const [varMinQty, setVarMinQty] = useState(1.0);
  const [varMaxQty, setVarMaxQty] = useState(20.0);
  const [varIsDefault, setVarIsDefault] = useState(false);
  const [varIsActive, setVarIsActive] = useState(true);
  const [savingVariant, setSavingVariant] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catSlug, setCatSlug] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameGu, setCatNameGu] = useState('');
  const [catDisplayOrder, setCatDisplayOrder] = useState(0);
  const [savingCategory, setSavingCategory] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: catData } = await supabase.from('categories').select('*').order('display_order', { ascending: true });
      const { data: unitData } = await supabase.from('product_units').select('*').order('name_en', { ascending: true });
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .order('display_order', { ascending: true });

      if (prodErr) throw prodErr;

      if (catData) setCategories(catData as Category[]);
      if (unitData) setUnits(unitData as ProductUnit[]);
      if (prodData) {
        const mapped = (prodData as any[]).map((p) => ({
          ...p,
          variants: (p.product_variants || []).sort((a: any, b: any) => Number(a.multiplier_to_base_unit) - Number(b.multiplier_to_base_unit)),
        }));
        setProducts(mapped as Product[]);
      }
    } catch (err: any) {
      console.error('Error loading products data:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load catalog data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  // Handle Product Image Upload to Supabase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
      setProdImageUrl(urlData.publicUrl);
    } catch (err: any) {
      console.error('Error uploading image:', err);
      alert(err.message || 'Failed to upload image. You can also paste an image URL directly.');
    } finally {
      setUploadingImage(false);
    }
  };

  // 1-Click Fast Toggle for In Stock / Out of Stock
  const handleToggleStock = async (prod: Product) => {
    const newStock = !prod.is_in_stock;
    // Optimistic UI update
    setProducts((prev) => prev.map((p) => p.id === prod.id ? { ...p, is_in_stock: newStock } : p));

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_in_stock: newStock })
        .eq('id', prod.id);

      if (error) throw error;
      setStatusMsg({
        type: 'success',
        text: `${prod.name_gu} is now ${newStock ? 'IN STOCK' : 'OUT OF STOCK'}.`,
      });
    } catch (err: any) {
      console.error('Error updating stock:', err);
      // Revert optimistic update
      loadData();
    }
  };

  // 1-Click Fast Toggle for Active/Inactive (Show/Hide on Storefront)
  const handleToggleActive = async (prod: Product) => {
    const newActive = !(prod.is_active ?? true);
    // Optimistic UI update
    setProducts((prev) => prev.map((p) => p.id === prod.id ? { ...p, is_active: newActive } : p));

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: newActive })
        .eq('id', prod.id);

      if (error) throw error;
      setStatusMsg({
        type: 'success',
        text: `${prod.name_gu} is now ${newActive ? 'VISIBLE on store' : 'HIDDEN from store'}.`,
      });
    } catch (err: any) {
      console.error('Error updating active state:', err);
      loadData();
    }
  };

  // Fast Inline Price Quick-Edit
  const handleQuickUpdateVariantPrice = async (variantId: string, newPriceVal: number) => {
    if (isNaN(newPriceVal) || newPriceVal <= 0) return;

    try {
      const { error } = await supabase.rpc('bulk_update_variant_prices', {
        p_updates: [{ variant_id: variantId, selling_price: newPriceVal }],
        p_change_reason: 'Quick Price Update',
      });

      if (error) throw error;
      setStatusMsg({ type: 'success', text: `Price updated to ₹${newPriceVal}` });
      await loadData();
    } catch (err: any) {
      console.error('Error saving price:', err);
      alert('Failed to update price');
    }
  };

  const openAddProductModal = () => {
    setEditingProductId(null);
    setProdCategoryId(categories[0]?.id || '');
    setProdBaseUnitId(units[0]?.id || '');
    setProdSlug('');
    setProdNameEn('');
    setProdNameGu('');
    setProdDescEn('');
    setProdDescGu('');
    setProdImageUrl('');
    setProdIsSeasonal(false);
    setProdIsInStock(true);
    setProdIsActive(true);
    setProdDisplayOrder(products.length + 1);
    setFastAddPrice1kg(40);
    setIsFastAdd(true);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProductId(prod.id);
    setProdCategoryId(prod.category_id);
    setProdBaseUnitId(prod.base_unit_id);
    setProdSlug(prod.slug);
    setProdNameEn(prod.name_en);
    setProdNameGu(prod.name_gu);
    setProdDescEn(prod.description_en || '');
    setProdDescGu(prod.description_gu || '');
    setProdImageUrl(prod.image_url || '');
    setProdIsSeasonal(prod.is_seasonal);
    setProdIsInStock(prod.is_in_stock);
    setProdIsActive(prod.is_active ?? true);
    setProdDisplayOrder(prod.display_order);
    setIsFastAdd(false);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodNameEn.trim() || !prodNameGu.trim()) {
      alert('Both English and Gujarati product names are required.');
      return;
    }

    setSavingProduct(true);
    try {
      const isCreating = !editingProductId;
      const { data: newProdId, error } = await supabase.rpc('admin_save_product', {
        p_id: editingProductId || null,
        p_category_id: prodCategoryId,
        p_base_unit_id: prodBaseUnitId,
        p_slug: prodSlug.trim() || prodNameEn.toLowerCase().replace(/\s+/g, '-'),
        p_name_en: prodNameEn.trim(),
        p_name_gu: prodNameGu.trim(),
        p_description_en: prodDescEn.trim() || null,
        p_description_gu: prodDescGu.trim() || null,
        p_image_url: prodImageUrl || null,
        p_is_seasonal: prodIsSeasonal,
        p_is_in_stock: prodIsInStock,
        p_is_active: prodIsActive,
        p_display_order: prodDisplayOrder,
      });

      if (error) throw error;

      // If Fast Add Mode is selected on create, automatically generate 250g, 500g, 1kg standard variants
      if (isCreating && isFastAdd && newProdId) {
        const kgPrice = Number(fastAddPrice1kg) || 40;
        const defaultPackVariants = [
          {
            name_en: '250g',
            name_gu: '૨૫૦ ગ્રામ',
            multiplier: 0.25,
            price: Math.round(kgPrice * 0.28), // slight markup for small pack
            is_default: false,
          },
          {
            name_en: '500g',
            name_gu: '૫૦૦ ગ્રામ',
            multiplier: 0.5,
            price: Math.round(kgPrice * 0.52),
            is_default: true,
          },
          {
            name_en: '1 kg',
            name_gu: '૧ કિલો',
            multiplier: 1.0,
            price: kgPrice,
            is_default: false,
          },
        ];

        for (const v of defaultPackVariants) {
          await supabase.rpc('admin_save_variant', {
            p_id: null,
            p_product_id: newProdId,
            p_unit_id: prodBaseUnitId,
            p_sku: `${prodNameEn.toUpperCase().slice(0, 4)}-${v.name_en}`,
            p_variant_name_en: v.name_en,
            p_variant_name_gu: v.name_gu,
            p_multiplier_to_base_unit: v.multiplier,
            p_selling_price: v.price,
            p_current_estimated_cost: 0.0,
            p_min_order_qty: 1.0,
            p_max_order_qty: 20.0,
            p_is_default: v.is_default,
            p_is_active: true,
            p_display_order: defaultPackVariants.indexOf(v) + 1,
          });
        }
      }

      setIsProductModalOpen(false);
      setStatusMsg({ type: 'success', text: `Vegetable "${prodNameGu}" saved successfully!` });
      await loadData();
    } catch (err: any) {
      console.error('Error saving product:', err);
      alert(err.message || 'Failed to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const openAddVariantModal = (prod: Product) => {
    setTargetProduct(prod);
    setEditingVariantId(null);
    setVarUnitId(units[0]?.id || '');
    setVarSku(`${prod.slug.toUpperCase()}-${(prod.variants?.length || 0) + 1}`);
    setVarNameEn('');
    setVarNameGu('');
    setVarMultiplier(1.0);
    setVarSellingPrice(0.0);
    setVarMinQty(1.0);
    setVarMaxQty(20.0);
    setVarIsDefault((prod.variants || []).length === 0);
    setVarIsActive(true);
    setIsVariantModalOpen(true);
  };

  const openEditVariantModal = (prod: Product, v: ProductVariant) => {
    setTargetProduct(prod);
    setEditingVariantId(v.id);
    setVarUnitId(v.unit_id);
    setVarSku(v.sku || '');
    setVarNameEn(v.variant_name_en);
    setVarNameGu(v.variant_name_gu);
    setVarMultiplier(Number(v.multiplier_to_base_unit));
    setVarSellingPrice(Number(v.selling_price));
    setVarMinQty(Number(v.min_order_qty));
    setVarMaxQty(Number(v.max_order_qty));
    setVarIsDefault(v.is_default);
    setVarIsActive(v.is_active !== false);
    setIsVariantModalOpen(true);
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;

    if (!varNameEn.trim() || !varNameGu.trim()) {
      alert('Both English and Gujarati variant names are required (e.g. 500g / ૫૦૦ ગ્રામ).');
      return;
    }

    setSavingVariant(true);
    try {
      const { error } = await supabase.rpc('admin_save_variant', {
        p_id: editingVariantId || null,
        p_product_id: targetProduct.id,
        p_unit_id: varUnitId,
        p_sku: varSku.trim() || null,
        p_variant_name_en: varNameEn.trim(),
        p_variant_name_gu: varNameGu.trim(),
        p_multiplier_to_base_unit: varMultiplier,
        p_selling_price: varSellingPrice,
        p_current_estimated_cost: 0.0,
        p_min_order_qty: varMinQty,
        p_max_order_qty: varMaxQty,
        p_is_default: varIsDefault,
        p_is_active: varIsActive,
        p_display_order: (targetProduct.variants?.length || 0) + 1,
      });

      if (error) throw error;

      setIsVariantModalOpen(false);
      setStatusMsg({ type: 'success', text: 'Pack size saved successfully!' });
      await loadData();
    } catch (err: any) {
      console.error('Error saving variant:', err);
      alert(err.message || 'Failed to save variant.');
    } finally {
      setSavingVariant(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategoryFilter === 'all' || p.category_id === selectedCategoryFilter;
    const matchesSearch = 
      !search.trim() ||
      p.name_en.toLowerCase().includes(search.toLowerCase()) ||
      p.name_gu.includes(search);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        
        {/* Header Banner */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <Package className="w-4 h-4" />
              <span>Catalog & Inventory Controller</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Vegetable Catalog & Pricing (શાકભાજી કેટલોગ)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1-click toggle product visibility, stock status, adjust daily pack prices, and add new items.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openAddProductModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-extrabold rounded-2xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Vegetable</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}>
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search vegetable by Gujarati or English name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategoryFilter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              All ({products.length})
            </button>

            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryFilter(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategoryFilter === c.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {c.name_gu}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
              <span>Loading vegetables catalog...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900 rounded-3xl p-8 text-slate-400 border border-slate-200 dark:border-slate-800">
              No products found matching your search.
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const category = categories.find((c) => c.id === prod.category_id);
              const variants = prod.variants || [];
              const isVisible = prod.is_active ?? true;

              return (
                <div
                  key={prod.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border shadow-xs p-5 flex flex-col justify-between transition-all ${
                    !isVisible
                      ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50 dark:bg-slate-950/40'
                      : !prod.is_in_stock
                      ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                  }`}
                >
                  <div>
                    {/* Top Row: Image, Info, and Controls */}
                    <div className="flex items-start gap-3.5 mb-3">
                      <div className="w-18 h-18 rounded-2xl bg-slate-100 dark:bg-slate-950 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name_en}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            🥬
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            {category?.name_gu || category?.name_en || 'General'}
                          </span>
                          {prod.is_seasonal && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Seasonal
                            </span>
                          )}
                          {!isVisible && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                              Hidden
                            </span>
                          )}
                        </div>

                        <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight mt-1">
                          {prod.name_gu} <span className="text-slate-500 font-normal text-xs">({prod.name_en})</span>
                        </h3>
                      </div>

                      <button
                        onClick={() => openEditProductModal(prod)}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                        title="Edit Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick Toggle Controls (Storefront Switch & In-Stock Switch) */}
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-3 text-xs font-bold">
                      {/* Toggle 1: Visible on Store */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(prod)}
                        className={`py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isVisible
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{isVisible ? 'Store: ON' : 'Store: OFF'}</span>
                      </button>

                      {/* Toggle 2: In Stock / Out of Stock */}
                      <button
                        type="button"
                        onClick={() => handleToggleStock(prod)}
                        className={`py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          prod.is_in_stock
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-rose-600 text-white shadow-2xs'
                        }`}
                      >
                        {prod.is_in_stock ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>{prod.is_in_stock ? 'In Stock' : 'Out of Stock'}</span>
                      </button>
                    </div>

                    {/* Variants & Pack Sizes List */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                        <span>Pack Sizes & Rates</span>
                        <button
                          onClick={() => openAddVariantModal(prod)}
                          className="text-emerald-600 font-bold hover:underline"
                        >
                          + Add Pack
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {variants.map((v) => (
                          <div
                            key={v.id}
                            className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {v.variant_name_gu || v.variant_name_en}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {v.variant_name_en}
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                ₹{Number(v.selling_price).toFixed(0)}
                              </span>
                              <button
                                onClick={() => openEditVariantModal(prod, v)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </main>

      {/* ADD / EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {editingProductId ? 'Edit Vegetable (શાકભાજી વિગત)' : 'Add New Vegetable (+ નવી શાકભાજી)'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Gujarati Name (ગુજરાતી નામ) *</label>
                  <input
                    type="text"
                    placeholder="દા.ત. ટામેટાં, બટાટા"
                    value={prodNameGu}
                    onChange={(e) => setProdNameGu(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">English Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Tomato, Potato"
                    value={prodNameEn}
                    onChange={(e) => setProdNameEn(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Category (કેટેગરી)</label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name_gu} ({c.name_en})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Base Unit</label>
                  <select
                    value={prodBaseUnitId}
                    onChange={(e) => setProdBaseUnitId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-bold text-slate-900 dark:text-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name_gu || u.name_en} ({u.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fast Add 1kg Rate for automatic 250g, 500g, 1kg generation */}
              {!editingProductId && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Auto-Create Standard Pack Sizes (250g, 500g, 1kg)</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Enter the standard 1kg rate. We will automatically create the 250g, 500g, and 1kg pack sizes.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-bold text-slate-700 dark:text-slate-200">1kg Rate (₹):</span>
                    <input
                      type="number"
                      value={fastAddPrice1kg}
                      onChange={(e) => setFastAddPrice1kg(Number(e.target.value))}
                      className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 font-mono font-black text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Photo Upload & URL */}
              <div className="space-y-2">
                <label className="block text-slate-500 font-bold">Vegetable Photo (ફોટો)</label>
                
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
                    {prodImageUrl ? (
                      <img src={prodImageUrl} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">🥬</div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Uploading...' : 'Upload from Phone/Device'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="Or paste image URL..."
                      value={prodImageUrl}
                      onChange={(e) => setProdImageUrl(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Seasonal Flag */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="seasonal_checkbox"
                  checked={prodIsSeasonal}
                  onChange={(e) => setProdIsSeasonal(e.target.checked)}
                  className="rounded-md w-4 h-4 text-emerald-600"
                />
                <label htmlFor="seasonal_checkbox" className="font-bold text-slate-700 dark:text-slate-300">
                  Mark as Seasonal Special (સીઝનલ સ્પેશિયલ)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 text-slate-500 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{editingProductId ? 'Save Changes' : 'Create Vegetable'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT VARIANT MODAL */}
      {isVariantModalOpen && targetProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">{targetProduct.name_gu}</span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Pack Size & Rate</h3>
              </div>
              <button onClick={() => setIsVariantModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Gujarati Pack Name</label>
                  <input
                    type="text"
                    placeholder="દા.ત. ૫૦૦ ગ્રામ"
                    value={varNameGu}
                    onChange={(e) => setVarNameGu(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">English Pack Name</label>
                  <input
                    type="text"
                    placeholder="e.g. 500g"
                    value={varNameEn}
                    onChange={(e) => setVarNameEn(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={varSellingPrice}
                    onChange={(e) => setVarSellingPrice(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-mono font-black text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Base Multiplier (kg)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={varMultiplier}
                    onChange={(e) => setVarMultiplier(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsVariantModalOpen(false)} className="px-3 py-2 text-slate-500 font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={savingVariant} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl">
                  {savingVariant ? 'Saving...' : 'Save Pack'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
