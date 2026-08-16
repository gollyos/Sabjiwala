'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, AddressInput } from '@/context/AuthContext';
import { 
  User, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Award, 
  LogOut, 
  Plus, 
  Home, 
  Briefcase, 
  Building,
  Loader2,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Package,
  Calendar,
  Clock,
  ChevronRight,
  ShoppingBag,
  CreditCard,
  Banknote
} from 'lucide-react';
import { CustomerAddress } from '@/types/sabjiwala';
import { createClient } from '@/lib/supabase/client';

interface CustomerOrderSummary {
  id: string;
  order_number: string;
  order_status: string;
  payment_method: string;
  payment_status: string;
  subtotal_amount: number;
  first_order_discount: number;
  cod_discount: number;
  delivery_charge: number;
  final_payable_amount: number;
  placed_at: string;
  confirmed_at?: string | null;
  delivery_date?: string | null;
  delivery_slot_start?: string | null;
  delivery_slot_end?: string | null;
  customer_name_snapshot: string;
  delivery_area_snapshot: string;
  item_count: number;
}

interface CustomerOrderItem {
  id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
  product_name_en: string;
  product_name_gu: string;
  variant_name_en: string;
  variant_name_gu: string;
  unit_code: string;
  selling_price: number;
  line_total: number;
}

interface CustomerOrderDetail extends CustomerOrderSummary {
  delivery_address: {
    flat_house: string;
    society_street: string;
    landmark?: string;
    area_locality: string;
    city: string;
    district: string;
    pincode: string;
  };
  special_instructions?: string | null;
  items: CustomerOrderItem[];
}

export default function ProfilePage() {
  const { 
    user,
    customer, 
    defaultAddress, 
    allAddresses, 
    saveAddress,
    deleteAddress,
    setDefaultAddress, 
    updateProfile,
    signOut,
    openAuthModal, 
    verifiedSequence,
    isOnboarded 
  } = useAuth();

  const [supabase] = useState(() => createClient());
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'edit_profile'>('orders');
  
  // Orders State
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<CustomerOrderDetail | null>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState<boolean>(false);

  // Profile edit state
  const [editName, setEditName] = useState(customer?.full_name || '');
  const [editAlternateMobile, setEditAlternateMobile] = useState(customer?.alternate_mobile || '');
  const [editEmail, setEditEmail] = useState(customer?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Address add / edit state
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrType, setAddrType] = useState<'home' | 'work' | 'temporary'>('home');
  const [flatHouseNo, setFlatHouseNo] = useState('');
  const [societyStreetName, setSocietyStreetName] = useState('');
  const [landmark, setLandmark] = useState('');
  const [areaLocality, setAreaLocality] = useState('');
  const [pincode, setPincode] = useState('389350');
  const [isDefault, setIsDefault] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch My Orders
  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase.rpc('get_my_orders');
      if (!error && data) {
        setOrders(data as CustomerOrderSummary[]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (activeTab === 'orders' && user) {
      loadOrders();
    }
  }, [activeTab, user, loadOrders]);

  // Fetch Order Detail
  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setLoadingOrderDetail(true);
    try {
      const { data, error } = await supabase.rpc('get_my_order_details', { p_order_id: orderId });
      if (!error && data) {
        setSelectedOrderDetail(data as CustomerOrderDetail);
      }
    } catch (err) {
      console.error('Failed to load order detail:', err);
    } finally {
      setLoadingOrderDetail(false);
    }
  };

  if (!user || !isOnboarded || !customer) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <User className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customer Account (ગ્રાહક ખાતું)</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Sign in with your phone OTP to view your orders and manage saved Halol delivery addresses.
          </p>
        </div>
        <button
          onClick={() => openAuthModal()}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 inline-flex items-center space-x-2 transition-all cursor-pointer"
        >
          <span>Sign In with Phone OTP</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const openAddAddressForm = () => {
    setEditingAddressId(null);
    setAddrType('home');
    setFlatHouseNo('');
    setSocietyStreetName('');
    setLandmark('');
    setAreaLocality('');
    setPincode('389350');
    setIsDefault(allAddresses.length === 0);
    setAddressError(null);
    setIsAddressFormOpen(true);
  };

  const openEditAddressForm = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setAddrType(addr.address_type);
    setFlatHouseNo(addr.flat_house_no);
    setSocietyStreetName(addr.society_street_name);
    setLandmark(addr.landmark || '');
    setAreaLocality(addr.area_locality);
    setPincode(addr.pincode || '389350');
    setIsDefault(addr.is_default);
    setAddressError(null);
    setIsAddressFormOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flatHouseNo.trim() || !societyStreetName.trim() || !areaLocality.trim()) {
      setAddressError('Please fill in Flat/House No, Society/Street, and Area in Halol.');
      return;
    }

    setAddressSaving(true);
    setAddressError(null);

    const payload: AddressInput = {
      id: editingAddressId || undefined,
      addressType: addrType,
      flatHouseNo: flatHouseNo.trim(),
      societyStreetName: societyStreetName.trim(),
      landmark: landmark.trim(),
      areaLocality: areaLocality.trim(),
      city: 'Halol',
      district: 'Panchmahal',
      state: 'Gujarat',
      pincode: pincode.trim() || '389350',
      isDefault,
    };

    const res = await saveAddress(payload);
    setAddressSaving(false);

    if (res.success) {
      setIsAddressFormOpen(false);
    } else {
      setAddressError(res.error || 'Failed to save address.');
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (confirm('Are you sure you want to delete this address?')) {
      setDeletingId(addrId);
      await deleteAddress(addrId);
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setSettingDefaultId(addressId);
    await setDefaultAddress(addressId);
    setSettingDefaultId(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setProfileMsg({ type: 'error', text: 'Full Name is required.' });
      return;
    }

    setProfileSaving(true);
    setProfileMsg(null);

    const res = await updateProfile({
      fullName: editName.trim(),
      alternateMobile: editAlternateMobile.trim() || undefined,
      email: editEmail.trim() || undefined,
    });

    setProfileSaving(false);
    if (res.success) {
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setProfileMsg(null), 3000);
    } else {
      setProfileMsg({ type: 'error', text: res.error || 'Failed to update profile.' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* Profile Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-extrabold text-2xl text-white shadow-inner">
            {customer.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{customer.full_name}</h2>
              {customer.is_verified && (
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              )}
            </div>
            <p className="text-sm text-emerald-200 mt-1 flex items-center gap-1.5">
              <Phone className="w-4 h-4" />
              <span>{customer.mobile}</span>
            </p>
          </div>
        </div>

        {verifiedSequence && (
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center sm:text-right">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Verified Customer Sequence
            </div>
            <div className="text-lg font-extrabold text-white">
              Customer #{verifiedSequence} in Halol
            </div>
            {verifiedSequence <= 500 && (
              <div className="text-xs text-emerald-200 mt-0.5">
                🎉 10% First Order Discount Unlocked
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 px-6 bg-slate-50/50 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('orders'); setSelectedOrderId(null); }}
            className={`py-4 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            My Orders (મારા ઓર્ડર)
          </button>
          <button
            onClick={() => { setActiveTab('addresses'); setIsAddressFormOpen(false); }}
            className={`py-4 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'addresses'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Saved Delivery Addresses ({allAddresses.length})
          </button>
          <button
            onClick={() => { setActiveTab('edit_profile'); setIsAddressFormOpen(false); }}
            className={`py-4 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'edit_profile'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Account Details (ખાતાની વિગતો)
          </button>
        </div>

        <div className="p-6 sm:p-8">
          
          {/* TAB 1: MY ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {selectedOrderId && selectedOrderDetail ? (
                /* Order Detail View */
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <button
                      onClick={() => setSelectedOrderId(null)}
                      className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      ← Back to All Orders
                    </button>
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                      {selectedOrderDetail.order_number}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1.5 text-xs text-slate-700">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-600" />
                        <span>Order Status</span>
                      </div>
                      <div className="capitalize font-bold text-emerald-800">
                        {selectedOrderDetail.order_status.replace('_', ' ')}
                      </div>
                      {selectedOrderDetail.delivery_date && (
                        <div className="flex items-center gap-1 text-slate-600 pt-1">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Delivery Date: <strong>{new Date(selectedOrderDetail.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Delivery Slot: <strong>10:00 AM – 01:00 PM (Halol)</strong></span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-700">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>Delivery Destination</span>
                      </div>
                      <div>{selectedOrderDetail.delivery_address.flat_house}, {selectedOrderDetail.delivery_address.society_street}</div>
                      <div className="text-slate-500">
                        {selectedOrderDetail.delivery_address.landmark && `${selectedOrderDetail.delivery_address.landmark}, `}
                        {selectedOrderDetail.delivery_address.area_locality}, Halol - {selectedOrderDetail.delivery_address.pincode}
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-3">
                      Ordered Vegetables ({selectedOrderDetail.items.length})
                    </h4>
                    <div className="space-y-2.5">
                      {selectedOrderDetail.items.map((item) => (
                        <div 
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              {item.product_name_gu} ({item.product_name_en})
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              Pack: {item.variant_name_gu || item.variant_name_en} • ₹{item.selling_price.toFixed(2)} / pack
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 text-sm">
                              ₹{item.line_total.toFixed(2)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Qty: {item.quantity}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Bill Breakdown */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Merchandise Subtotal</span>
                      <span className="font-semibold text-slate-900">₹{selectedOrderDetail.subtotal_amount.toFixed(2)}</span>
                    </div>

                    {selectedOrderDetail.first_order_discount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>FIRST500 Launch Offer (10%)</span>
                        <span>- ₹{selectedOrderDetail.first_order_discount.toFixed(2)}</span>
                      </div>
                    )}

                    {selectedOrderDetail.cod_discount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>Cash On Delivery Discount (2%)</span>
                        <span>- ₹{selectedOrderDetail.cod_discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Charge (Halol)</span>
                      <span className="font-bold text-emerald-700 uppercase">FREE</span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                      <span>Final Total Paid / Payable</span>
                      <span className="text-emerald-700 text-base">₹{selectedOrderDetail.final_payable_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : loadingOrders ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                  <p className="text-xs font-semibold">Loading your order history...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">No Orders Placed Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    You have not placed any vegetable orders yet. Browse our daily fresh Halol catalog to start!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => handleSelectOrder(ord.id)}
                      className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 font-mono">
                            {ord.order_number}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {ord.order_status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Placed: {new Date(ord.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {ord.item_count} vegetable items
                        </div>
                        <div className="text-xs text-slate-600">
                          Destination: {ord.delivery_area_snapshot}, Halol
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-emerald-800">
                            ₹{ord.final_payable_amount.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">
                            Cash on Delivery (COD)
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              {!isAddressFormOpen ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">Your Delivery Locations</h3>
                      <p className="text-xs text-slate-500">Halol, Gujarat (Panchmahal)</p>
                    </div>
                    <button
                      onClick={openAddAddressForm}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Address</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allAddresses.map((addr) => {
                      const isAddrDefault = defaultAddress?.id === addr.id;
                      return (
                        <div
                          key={addr.id}
                          className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                            isAddrDefault
                              ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/30'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                                  {addr.address_type === 'home' && <Home className="w-4 h-4" />}
                                  {addr.address_type === 'work' && <Briefcase className="w-4 h-4" />}
                                  {addr.address_type === 'temporary' && <Building className="w-4 h-4" />}
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                  {addr.address_type} Address
                                </span>
                                {isAddrDefault && (
                                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Default
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={() => openEditAddressForm(addr)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {allAddresses.length > 1 && (
                                  <button
                                    onClick={() => handleDeleteAddress(addr.id)}
                                    disabled={deletingId === addr.id}
                                    className="p-1.5 text-red-400 hover:text-red-600 rounded-lg disabled:opacity-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="text-sm font-medium text-slate-800 leading-relaxed">
                              {addr.flat_house_no}, {addr.society_street_name}
                              <div className="text-xs text-slate-500 font-normal mt-1">
                                {addr.landmark && `Landmark: ${addr.landmark} • `}Area: {addr.area_locality}
                              </div>
                              <div className="text-xs text-slate-500 font-normal">
                                {addr.city}, {addr.district} - {addr.pincode}
                              </div>
                            </div>
                          </div>

                          {!isAddrDefault && (
                            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                              <button
                                onClick={() => handleSetDefault(addr.id)}
                                disabled={settingDefaultId === addr.id}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 disabled:text-slate-400"
                              >
                                {settingDefaultId === addr.id ? 'Setting Default...' : 'Make Default'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Address Add / Edit Form */
                <form onSubmit={handleSaveAddress} className="max-w-xl space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h4 className="font-bold text-base text-slate-800">
                      {editingAddressId ? 'Edit Address' : 'Add New Halol Address'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddressFormOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>

                  {addressError && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{addressError}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    {(['home', 'work', 'temporary'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAddrType(t)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                          addrType === t
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Flat / House / Bungalow No. *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. B-402, Gokul Dham"
                        value={flatHouseNo}
                        onChange={(e) => setFlatHouseNo(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Society / Street / Complex *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Godhra Road / Pavagadh Road"
                        value={societyStreetName}
                        onChange={(e) => setSocietyStreetName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Landmark (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Near Bus Stand"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Area / Locality *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Kanjari Road Area"
                          value={areaLocality}
                          onChange={(e) => setAreaLocality(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">City</label>
                        <input
                          type="text"
                          value="Halol"
                          disabled
                          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">District</label>
                        <input
                          type="text"
                          value="Panchmahal"
                          disabled
                          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pincode *</label>
                        <input
                          type="text"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value)}
                          placeholder="389350"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="page_is_default_check"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
                      />
                      <label htmlFor="page_is_default_check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        Set as default delivery address (મુખ્ય સરનામું બનાવો)
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsAddressFormOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addressSaving}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {addressSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Address</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: EDIT PROFILE */}
          {activeTab === 'edit_profile' && (
            <form onSubmit={handleSaveProfile} className="max-w-md space-y-4">
              {profileMsg && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name (પૂરું નામ) *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Mobile (પ્રાથમિક નંબર)
                </label>
                <input
                  type="text"
                  value={customer.mobile}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Primary phone number is verified via OTP and cannot be modified directly.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alternate Mobile (વૈકલ્પિક નંબર)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876543211"
                  value={editAlternateMobile}
                  onChange={(e) => setEditAlternateMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (ઈમેલ)
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Profile...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer Logout */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Halol APMC Sourced Fresh Produce
          </div>
          <button
            onClick={signOut}
            className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out (લૉગ આઉટ)</span>
          </button>
        </div>

      </div>

    </div>
  );
}
