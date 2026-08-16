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
  Tag
} from 'lucide-react';

export default function AdminProductsPage() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      if (prodData) setProducts(prodData as Product[]);
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

      const { data, error } = await supabase.storage
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
      alert(err.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
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
      const { data, error } = await supabase.rpc('admin_save_product', {
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

      setIsProductModalOpen(false);
      setStatusMsg({ type: 'success', text: 'Product saved successfully!' });
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
      const { data, error } = await supabase.rpc('admin_save_variant', {
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
      setStatusMsg({ type: 'success', text: 'Variant saved successfully!' });
      await loadData();
    } catch (err: any) {
      console.error('Error saving variant:', err);
      alert(err.message || 'Failed to save variant.');
    } finally {
      setSavingVariant(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameEn.trim() || !catNameGu.trim()) {
      alert('Category names in English and Gujarati are required.');
      return;
    }

    setSavingCategory(true);
    try {
      const { data, error } = await supabase.rpc('admin_save_category', {
        p_id: null,
        p_slug: catSlug.trim() || catNameEn.toLowerCase().replace(/\s+/g, '-'),
        p_name_en: catNameEn.trim(),
        p_name_gu: catNameGu.trim(),
        p_display_order: catDisplayOrder || categories.length + 1,
        p_is_active: true,
      });

      if (error) throw error;

      setIsCategoryModalOpen(false);
      setStatusMsg({ type: 'success', text: 'Category created successfully!' });
      await loadData();
    } catch (err: any) {
      console.error('Error saving category:', err);
      alert(err.message || 'Failed to save category.');
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        
        {/* Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              <Package className="w-4 h-4" />
              <span>Catalog & Variant Controller</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Product & Variant Management (શાકભાજી કેટલોગ)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage vegetables, multi-pack variants (250g, 500g, 1kg, bunches), images, and stock availability.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setCatSlug('');
                setCatNameEn('');
                setCatNameGu('');
                setCatDisplayOrder(categories.length + 1);
                setIsCategoryModalOpen(true);
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer"
            >
              + Add Category
            </button>

            <button
              onClick={openAddProductModal}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-2xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vegetable</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div
            className={`mb-6 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-fadeIn ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                : 'bg-red-50 text-red-900 border border-red-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Product Cards Grid with Variant Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
              <span>Loading products and variants...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl p-8 text-slate-400 border border-slate-200">
              No products found in catalog. Click Add Vegetable to create one.
            </div>
          ) : (
            products.map((prod) => {
              const category = categories.find((c) => c.id === prod.category_id);
              const variants = prod.variants || [];

              return (
                <div
                  key={prod.id}
                  className={`bg-white rounded-3xl border shadow-sm p-6 flex flex-col justify-between transition-all ${
                    !prod.is_in_stock ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
                  }`}
                >
                  <div>
                    {/* Top Row: Image + Main Info */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name_en}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🥬
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                            {category?.name_gu || category?.name_en || 'General'}
                          </span>
                          {prod.is_seasonal && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Seasonal
                            </span>
                          )}
                          {!prod.is_in_stock && (
                            <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[10px] font-bold">
                              Out of Stock
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-base text-slate-900 leading-snug mt-1">
                          {prod.name_gu}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500">
                          {prod.name_en}
                        </p>
                      </div>

                      <button
                        onClick={() => openEditProductModal(prod)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                        title="Edit Product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Variants Breakdown */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-emerald-600" />
                          Pack Variants ({variants.length})
                        </span>
                        <button
                          onClick={() => openAddVariantModal(prod)}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Variant</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {variants.map((v) => (
                          <div
                            key={v.id}
                            className="px-3 py-2 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-100"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">
                                {v.variant_name_gu || v.variant_name_en}
                              </span>
                              {v.is_default && (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                              {v.is_active === false && (
                                <span className="bg-slate-200 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  Disabled
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-3">
                              <span className="font-mono font-extrabold text-emerald-700">
                                ₹{Number(v.selling_price).toFixed(2)}
                              </span>
                              <button
                                onClick={() => openEditVariantModal(prod, v)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                                title="Edit Variant"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
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

      </div>

      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-lg text-slate-900">
                {editingProductId ? 'Edit Vegetable' : 'Add New Vegetable'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gujarati Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. ટામેટાં"
                    value={prodNameGu}
                    onChange={(e) => setProdNameGu(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">English Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Fresh Desi Tomato"
                    value={prodNameEn}
                    onChange={(e) => setProdNameEn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_gu} ({c.name_en})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Base Unit *</label>
                  <select
                    value={prodBaseUnitId}
                    onChange={(e) => setProdBaseUnitId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name_gu} ({u.name_en})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Image (Supabase Storage)
                </label>
                <div className="flex items-center space-x-3">
                  {prodImageUrl && (
                    <img
                      src={prodImageUrl}
                      alt="Preview"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                  {uploadingImage && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="instock_chk"
                    checked={prodIsInStock}
                    onChange={(e) => setProdIsInStock(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  <label htmlFor="instock_chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                    In Stock (ઉપલબ્ધ છે)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="seasonal_chk"
                    checked={prodIsSeasonal}
                    onChange={(e) => setProdIsSeasonal(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded-sm"
                  />
                  <label htmlFor="seasonal_chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Seasonal (મોસમી)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || uploadingImage}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {savingProduct ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT VARIANT */}
      {isVariantModalOpen && targetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingVariantId ? 'Edit Pack Variant' : 'Add Pack Variant'}
                </h3>
                <p className="text-xs text-slate-500">For {targetProduct.name_gu} ({targetProduct.name_en})</p>
              </div>
              <button
                onClick={() => setIsVariantModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gujarati Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. ૫૦૦ ગ્રામ"
                    value={varNameGu}
                    onChange={(e) => setVarNameGu(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">English Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. 500 Grams"
                    value={varNameEn}
                    onChange={(e) => setVarNameEn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={varSellingPrice}
                    onChange={(e) => setVarSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit *</label>
                  <select
                    value={varUnitId}
                    onChange={(e) => setVarUnitId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name_gu} ({u.name_en})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Multiplier to Base Unit</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={varMultiplier}
                    onChange={(e) => setVarMultiplier(parseFloat(e.target.value) || 1.0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={varSku}
                    onChange={(e) => setVarSku(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="v_def_chk"
                    checked={varIsDefault}
                    onChange={(e) => setVarIsDefault(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  <label htmlFor="v_def_chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Default Selection
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="v_act_chk"
                    checked={varIsActive}
                    onChange={(e) => setVarIsActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  <label htmlFor="v_act_chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Active
                  </label>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVariant}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {savingVariant ? 'Saving...' : 'Save Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD CATEGORY */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900">Add Category</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gujarati Name *</label>
                <input
                  type="text"
                  placeholder="e.g. કંદમૂળ"
                  value={catNameGu}
                  onChange={(e) => setCatNameGu(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">English Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Root Vegetables"
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  {savingCategory ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
