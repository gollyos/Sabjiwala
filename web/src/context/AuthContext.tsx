'use client';

import { getErrorMessage } from '@/lib/errors';




import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Customer, CustomerAddress, CustomerProfileState } from '@/types/sabjiwala';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface AddressInput {
  id?: string;
  addressType?: 'home' | 'work' | 'temporary';
  flatHouseNo: string;
  societyStreetName: string;
  landmark?: string;
  areaLocality: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

export interface OnboardingInput {
  fullName: string;
  alternateMobile?: string;
  email?: string;
  addressType?: 'home' | 'work' | 'temporary';
  flatHouseNo: string;
  societyStreetName: string;
  landmark?: string;
  areaLocality: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface ProfileUpdateInput {
  fullName: string;
  alternateMobile?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  customer: Customer | null;
  defaultAddress: CustomerAddress | null;
  allAddresses: CustomerAddress[];
  isOnboarded: boolean;
  isVerified: boolean;
  verifiedSequence: number | null;
  loading: boolean;
  authModalOpen: boolean;
  profileModalOpen: boolean;
  openAuthModal: (onSuccessCallback?: () => void) => void;
  closeAuthModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  normalizePhone: (mobile: string) => string;
  sendOtp: (mobile: string) => Promise<{ success: boolean; isDevMode?: boolean; error?: string }>;
  verifyOtp: (mobile: string, token: string) => Promise<{ success: boolean; isOnboarded: boolean; error?: string }>;
  completeOnboarding: (data: OnboardingInput) => Promise<{ success: boolean; error?: string; sequence?: number }>;
  saveAddress: (data: AddressInput) => Promise<{ success: boolean; error?: string }>;
  deleteAddress: (addressId: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultAddress: (addressId: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: ProfileUpdateInput) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function normalizePhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [defaultAddress, setDefaultAddressState] = useState<CustomerAddress | null>(null);
  const [allAddresses, setAllAddresses] = useState<CustomerAddress[]>([]);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [postAuthCallback, setPostAuthCallback] = useState<(() => void) | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_customer_profile');
      if (error) {
        console.error('Error fetching customer profile:', error);
        return;
      }

      const res = data as CustomerProfileState;
      if (res && res.authenticated) {
        setIsOnboarded(!!res.is_onboarded);
        setCustomer(res.customer || null);
        setDefaultAddressState(res.default_address || null);
        setAllAddresses(res.addresses || []);
      } else {
        setIsOnboarded(false);
        setCustomer(null);
        setDefaultAddressState(null);
        setAllAddresses([]);
      }
    } catch (err) {
      console.error('Exception fetching profile:', err);
    }
  }, [supabase]);

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile();
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile();
      } else {
        setCustomer(null);
        setDefaultAddressState(null);
        setAllAddresses([]);
        setIsOnboarded(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const openAuthModal = (onSuccessCallback?: () => void) => {
    if (onSuccessCallback) {
      setPostAuthCallback(() => onSuccessCallback);
    } else {
      setPostAuthCallback(null);
    }
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const openProfileModal = () => {
    setProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
  };

  const sendOtp = async (mobile: string): Promise<{ success: boolean; isDevMode?: boolean; error?: string }> => {
    try {
      const formattedPhone = normalizePhone(mobile);
      if (formattedPhone.length < 13) {
        return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? getErrorMessage(err) : 'Unable to send OTP. Please try again.' };
    }
  };

  const verifyOtp = async (mobile: string, token: string): Promise<{ success: boolean; isOnboarded: boolean; error?: string }> => {
    try {
      const formattedPhone = normalizePhone(mobile);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: token.trim(),
        type: 'sms',
      });

      if (error || !data?.user) {
        return { success: false, isOnboarded: false, error: error?.message || 'Invalid OTP. Request a new code and try again.' };
      }

      setUser(data.user);
      
      const { data: profileData, error: profileErr } = await supabase.rpc('get_current_customer_profile');
      if (profileErr) {
        console.error('Error getting profile on verification:', profileErr);
      }

      const res = profileData as CustomerProfileState;
      const onboarded = !!(res && res.is_onboarded);

      if (res && res.authenticated) {
        setIsOnboarded(onboarded);
        setCustomer(res.customer || null);
        setDefaultAddressState(res.default_address || null);
        setAllAddresses(res.addresses || []);
      }

      if (onboarded) {
        if (postAuthCallback) {
          postAuthCallback();
          setPostAuthCallback(null);
        }
        setAuthModalOpen(false);
      }

      return { success: true, isOnboarded: onboarded };
    } catch (err: unknown) {
      return { success: false, isOnboarded: false, error: err instanceof Error ? getErrorMessage(err) : 'Verification failed' };
    }
  };

  const completeOnboarding = async (data: OnboardingInput): Promise<{ success: boolean; error?: string; sequence?: number }> => {
    try {
      const { data: result, error } = await supabase.rpc('complete_customer_onboarding', {
        p_full_name: data.fullName,
        p_alternate_mobile: data.alternateMobile ? normalizePhone(data.alternateMobile) : null,
        p_email: data.email || null,
        p_address_type: data.addressType || 'home',
        p_flat_house_no: data.flatHouseNo,
        p_society_street_name: data.societyStreetName,
        p_landmark: data.landmark || '',
        p_area_locality: data.areaLocality,
        p_city: data.city || 'Halol',
        p_district: data.district || 'Panchmahal',
        p_state: data.state || 'Gujarat',
        p_pincode: data.pincode || '389350',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = result as CustomerProfileState;
      if (res) {
        setIsOnboarded(true);
        setCustomer(res.customer || null);
        setDefaultAddressState(res.default_address || null);
        setAllAddresses(res.addresses || []);
      }

      if (postAuthCallback) {
        postAuthCallback();
        setPostAuthCallback(null);
      }

      return {
        success: true,
        sequence: res?.customer?.verified_sequence ?? undefined,
      };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) || 'Failed to complete profile' };
    }
  };

  const saveAddress = async (data: AddressInput): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: result, error } = await supabase.rpc('save_customer_address', {
        p_address_id: data.id || null,
        p_address_type: data.addressType || 'home',
        p_flat_house_no: data.flatHouseNo,
        p_society_street_name: data.societyStreetName,
        p_landmark: data.landmark || '',
        p_area_locality: data.areaLocality,
        p_city: data.city || 'Halol',
        p_district: data.district || 'Panchmahal',
        p_state: data.state || 'Gujarat',
        p_pincode: data.pincode || '389350',
        p_latitude: data.latitude || null,
        p_longitude: data.longitude || null,
        p_is_default: data.isDefault ?? false,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = result as CustomerProfileState;
      if (res) {
        setDefaultAddressState(res.default_address || null);
        setAllAddresses(res.addresses || []);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) || 'Failed to save address' };
    }
  };

  const deleteAddress = async (addressId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('delete_customer_address', {
        p_address_id: addressId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as CustomerProfileState;
      if (res) {
        setDefaultAddressState(res.default_address || null);
        setAllAddresses(res.addresses || []);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) || 'Failed to delete address' };
    }
  };

  const setDefaultAddress = async (addressId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('set_default_customer_address', {
        p_address_id: addressId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as CustomerProfileState;
      if (res) {
        setDefaultAddressState(res.default_address || null);
        setAllAddresses(res.addresses || []);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) || 'Failed to update default address' };
    }
  };

  const updateProfile = async (data: ProfileUpdateInput): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: result, error } = await supabase.rpc('update_customer_profile_info', {
        p_full_name: data.fullName,
        p_alternate_mobile: data.alternateMobile ? normalizePhone(data.alternateMobile) : null,
        p_email: data.email || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = result as CustomerProfileState;
      if (res && res.customer) {
        setCustomer(res.customer);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) || 'Failed to update profile' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCustomer(null);
    setDefaultAddressState(null);
    setAllAddresses([]);
    setIsOnboarded(false);
    setProfileModalOpen(false);
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer,
        defaultAddress,
        allAddresses,
        isOnboarded,
        isVerified: !!customer?.is_verified,
        verifiedSequence: customer?.verified_sequence ?? null,
        loading,
        authModalOpen,
        profileModalOpen,
        openAuthModal,
        closeAuthModal,
        openProfileModal,
        closeProfileModal,
        normalizePhone,
        sendOtp,
        verifyOtp,
        completeOnboarding,
        saveAddress,
        deleteAddress,
        setDefaultAddress,
        updateProfile,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
