'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  KeyRound, 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  Sparkles,
  Lock,
  Leaf
} from 'lucide-react';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [supabase] = useState(() => createClient());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminUser, setAdminUser] = useState<{ full_name: string; role: string; mobile: string } | null>(null);

  // Login form state
  const [authTab, setAuthTab] = useState<'pin' | 'mobile'>('pin');
  const [pin, setPin] = useState('');
  const [mobile, setMobile] = useState('9876543210');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyAdminAccess = useCallback(async () => {
    try {
      setCheckingAuth(true);

      // 1. Check local admin session storage/cookie first
      const storedSession = typeof window !== 'undefined' ? localStorage.getItem('taazatokra_admin_user') : null;
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          if (parsed && parsed.role && ['owner', 'manager', 'packing', 'procurement', 'delivery'].includes(parsed.role)) {
            setAdminUser(parsed);
            setIsAuthorized(true);
            setCheckingAuth(false);
            return;
          }
        } catch {
          // ignore corrupted json
        }
      }

      // 2. Check Supabase Auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);

        if (roleData && roleData.length > 0) {
          const roles = roleData.map(r => r.role);
          const hasStaffAccess = roles.some(r => ['owner', 'manager', 'packing', 'procurement'].includes(r));
          if (hasStaffAccess) {
            const userObj = {
              full_name: session.user.user_metadata?.full_name || 'Staff User',
              role: roles[0],
              mobile: session.user.phone || '+919876543210',
            };
            setAdminUser(userObj);
            setIsAuthorized(true);
            if (typeof window !== 'undefined') {
              localStorage.setItem('taazatokra_admin_user', JSON.stringify(userObj));
            }
            setCheckingAuth(false);
            return;
          }
        }
      }

      setIsAuthorized(false);
    } catch (err) {
      console.error('Error verifying admin authorization:', err);
      setIsAuthorized(false);
    } finally {
      setCheckingAuth(false);
    }
  }, [supabase]);

  useEffect(() => {
    verifyAdminAccess();
  }, [verifyAdminAccess]);

  // Handle PIN Login
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter the 4-digit Owner PIN.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'pin', pin: pin.trim() }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        setAdminUser(data.user);
        setIsAuthorized(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('taazatokra_admin_user', JSON.stringify(data.user));
        }
      } else {
        setError(data.error || 'Incorrect Owner PIN. Try default PIN: 7890');
      }
    } catch {
      setError('Connection failed. Please check network.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Mobile OTP Login
  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      if (mobile.replace(/\D/g, '').length !== 10) {
        setError('Please enter a valid 10-digit mobile number.');
        return;
      }
      setError(null);
      setOtpSent(true);
      return;
    }

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'mobile', mobile, otp: otpCode }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        setAdminUser(data.user);
        setIsAuthorized(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('taazatokra_admin_user', JSON.stringify(data.user));
        }
      } else {
        setError(data.error || 'Invalid OTP. Try test OTP: 123456');
      }
    } catch {
      setError('Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading indicator
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-pulse mb-3">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
        <p className="text-sm font-bold text-slate-200">Loading TaazaTokra Admin HQ...</p>
      </div>
    );
  }

  // If Not Authorized -> Show Dedicated Sleek Admin Login Form
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 text-white text-center relative">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 mx-auto flex items-center justify-center mb-3 shadow-inner">
              <Leaf className="w-6 h-6 text-emerald-200" />
            </div>
            <h1 className="text-xl font-black tracking-tight">TaazaTokra Admin HQ</h1>
            <p className="text-xs text-emerald-100 font-medium mt-1">
              તાજાટોકરા એડમિન અને માલિક કંટ્રોલ પોર્ટલ (Halol)
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthTab('pin'); setError(null); }}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'pin'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Owner Master PIN</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuthTab('mobile'); setError(null); }}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'mobile'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Staff Mobile OTP</span>
              </button>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 flex items-start gap-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: Master PIN Form */}
            {authTab === 'pin' && (
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Enter Owner Security PIN (માલિક પિન)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={8}
                      placeholder="Enter 4-digit PIN (e.g. 7890)"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-white font-mono text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                      autoFocus
                    />
                  </div>
                  <div className="mt-2.5 p-2.5 bg-emerald-950/30 rounded-xl border border-emerald-800/40 text-center text-xs text-emerald-300 font-medium">
                    🔑 Owner Default PIN: <strong className="text-white font-mono font-bold">7890</strong>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !pin}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Unlock Admin Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: Mobile OTP Form */}
            {authTab === 'mobile' && (
              <form onSubmit={handleMobileSubmit} className="space-y-4">
                {!otpSent ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Registered Staff Mobile
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-slate-400 font-bold text-sm">
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-14 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                        autoFocus
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Sample Owner Phone: <strong className="text-slate-200">9876543210</strong>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Enter 6-Digit OTP
                      </label>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-[11px] text-emerald-400 hover:underline"
                      >
                        Change Number
                      </button>
                    </div>
                    <div className="flex justify-center gap-2">
                      {otp.map((d, idx) => (
                        <input
                          key={idx}
                          type="text"
                          maxLength={1}
                          inputMode="numeric"
                          value={d}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newOtp = [...otp];
                            newOtp[idx] = val;
                            setOtp(newOtp);
                            if (val && idx < 5) {
                              const nextInput = document.getElementById(`otp-admin-${idx + 1}`);
                              nextInput?.focus();
                            }
                          }}
                          id={`otp-admin-${idx}`}
                          className="w-10 h-12 text-center text-lg font-bold bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          autoFocus={idx === 0}
                        />
                      ))}
                    </div>
                    <div className="mt-2.5 p-2 bg-emerald-950/30 rounded-xl border border-emerald-800/40 text-center text-xs text-emerald-300 font-medium">
                      🔑 Test OTP: <strong className="text-white font-mono">123456</strong>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{!otpSent ? 'Send OTP' : 'Verify & Enter HQ'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Back to Customer Store Link */}
            <div className="pt-2 border-t border-slate-800/80 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Customer Storefront (ગ્રાહક સાઇટ)</span>
              </Link>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin/Staff -> Render Children
  return (
    <div>
      {children}
    </div>
  );
}
