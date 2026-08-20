'use client';

import React, { useState } from 'react';
import { useAuth, AddressInput } from '@/context/AuthContext';
import { CustomerAddress } from '@/types/sabjiwala';
import { 
  X, 
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
  AlertCircle
} from 'lucide-react';

export function CustomerProfileModal() {
  const { 
    profileModalOpen, 
    closeProfileModal, 
    customer, 
    defaultAddress, 
    allAddresses, 
    saveAddress,
    deleteAddress,
    setDefaultAddress, 
    updateProfile,
    signOut, 
    verifiedSequence 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'addresses' | 'edit_profile'>('addresses');
  
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

  if (!profileModalOpen || !customer) return null;

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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 dark:border-slate-800 animate-scaleUp flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-xl text-white shadow-inner">
              {customer.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                <span>{customer.full_name}</span>
                {customer.is_verified && (
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                )}
              </h3>
              <p className="text-xs text-emerald-100 flex items-center gap-1.5 mt-0.5 font-medium">
                <Phone className="w-3.5 h-3.5" />
                <span>{customer.mobile}</span>
              </p>
            </div>
          </div>
          <button
            onClick={closeProfileModal}
            aria-label="Close profile modal"
            className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/70 dark:bg-slate-950/70 shrink-0">
          <button
            onClick={() => { setActiveTab('addresses'); setIsAddressFormOpen(false); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'addresses'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Saved Addresses ({allAddresses.length})
          </button>
          <button
            onClick={() => { setActiveTab('edit_profile'); setIsAddressFormOpen(false); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'edit_profile'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Edit Profile
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Verified Customer Status */}
          {verifiedSequence && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-amber-500/10 border border-amber-300/80 dark:border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                    Verified Customer Sequence
                  </div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Customer #{verifiedSequence} in Halol
                  </div>
                </div>
              </div>
              {verifiedSequence <= 500 && (
                <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-sm">
                  10% OFF with FIRST500
                </span>
              )}
            </div>
          )}

          {/* TAB 1: Addresses */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              
              {!isAddressFormOpen ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Delivery Addresses (સરનામાં)
                    </h4>
                    <button
                      onClick={openAddAddressForm}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Address</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {allAddresses.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
                        No delivery address saved yet. Click Add New Address to add one.
                      </div>
                    ) : (
                      allAddresses.map((addr) => {
                        const isAddrDefault = defaultAddress?.id === addr.id;
                        return (
                          <div
                            key={addr.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isAddrDefault
                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm ring-1 ring-emerald-500/30'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {addr.address_type === 'home' && <Home className="w-3.5 h-3.5" />}
                                  {addr.address_type === 'work' && <Briefcase className="w-3.5 h-3.5" />}
                                  {addr.address_type === 'temporary' && <Building className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                  {addr.address_type}
                                </span>
                                {isAddrDefault && (
                                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Default
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-2">
                                {!isAddrDefault && (
                                  <button
                                    onClick={() => handleSetDefault(addr.id)}
                                    disabled={settingDefaultId === addr.id}
                                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 disabled:text-slate-400 min-h-[32px] px-2 cursor-pointer"
                                  >
                                    {settingDefaultId === addr.id ? 'Setting...' : 'Set as Default'}
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditAddressForm(addr)}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                                  title="Edit Address"
                                  aria-label="Edit Address"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {allAddresses.length > 1 && (
                                  <button
                                    onClick={() => handleDeleteAddress(addr.id)}
                                    disabled={deletingId === addr.id}
                                    className="p-1.5 text-red-400 hover:text-red-600 rounded-lg disabled:opacity-50 cursor-pointer"
                                    title="Delete Address"
                                    aria-label="Delete Address"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                              {addr.flat_house_no}, {addr.society_street_name}
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                                {addr.landmark && `Landmark: ${addr.landmark} • `}Area: {addr.area_locality}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                {addr.city}, {addr.district} - {addr.pincode}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                /* Address Add / Edit Form */
                <form onSubmit={handleSaveAddress} className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {editingAddressId ? 'Edit Address' : 'Add New Halol Address'}
                    </h5>
                    <button
                      type="button"
                      onClick={() => setIsAddressFormOpen(false)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 min-h-[32px] px-2 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {addressError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{addressError}</span>
                    </div>
                  )}

                  {/* Address Type Selector */}
                  <div className="flex items-center space-x-2">
                    {(['home', 'work', 'temporary'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAddrType(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all min-h-[36px] cursor-pointer ${
                          addrType === t
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Flat / House / Bungalow No. *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. B-402, Gokul Dham"
                        value={flatHouseNo}
                        onChange={(e) => setFlatHouseNo(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Society / Street / Complex *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Godhra Road / Pavagadh Road"
                        value={societyStreetName}
                        onChange={(e) => setSocietyStreetName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Landmark (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Near Bus Stand"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Area / Locality *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Kanjari Road Area"
                          value={areaLocality}
                          onChange={(e) => setAreaLocality(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">City</label>
                        <input
                          type="text"
                          value="Halol"
                          disabled
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">District</label>
                        <input
                          type="text"
                          value="Panchmahal"
                          disabled
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Pincode *</label>
                        <input
                          type="text"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value)}
                          placeholder="389350"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_default_check"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                      />
                      <label htmlFor="is_default_check" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Set as default delivery address (મુખ્ય સરનામું બનાવો)
                      </label>
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsAddressFormOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 min-h-[44px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addressSaving}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                    >
                      {addressSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
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

          {/* TAB 2: Edit Profile */}
          {activeTab === 'edit_profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMsg && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  }`}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (પૂરું નામ) *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Verified Mobile (મોબાઇલ નંબર)
                </label>
                <input
                  type="text"
                  value={customer.mobile}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed min-h-[44px]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Primary phone number is verified and cannot be changed directly.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alternate Mobile (વૈકલ્પિક નંબર)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876543211"
                  value={editAlternateMobile}
                  onChange={(e) => setEditAlternateMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (ઈમેલ)
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                />
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px]"
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
            </form>
          )}

        </div>

        {/* Footer Logout */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            Halol Delivery System • Sabjiwala
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer min-h-[36px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out (લૉગ આઉટ)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
