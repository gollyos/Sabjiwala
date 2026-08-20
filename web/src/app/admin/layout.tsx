'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  ShieldCheck,
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

  // Strict Mobile + OTP login state
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);

  const verifyAdminAccess = useCallback(async () => {
    try {
      setCheckingAuth(true);

      // 1. Check local admin session storage/cookie
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
          // ignore error
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
          const hasStaffAccess = roles.some(r => ['owner', 'manager', 'packing', 'procurement', 'delivery'].includes(r));
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

  // Resend Timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpSent && resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpSent, resendTimer]);

  // Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = mobile.replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      setError('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setOtpSent(true);
    setResendTimer(30);
    setSubmitting(false);
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError(data.error || 'Authentication failed. Please check OTP.');
      }
    } catch {
      setError('Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shadow-sm mb-3">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
        <p className="text-sm font-bold text-slate-700">Verifying Admin Credentials...</p>
      </div>
    );
  }

  // If Not Authorized -> Show Clean White Security Card
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 mx-auto flex items-center justify-center mb-3 shadow-xs">
              <Leaf className="w-6 h-6 text-emerald-100" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">TaazaTokra Admin HQ</h1>
            <p className="text-xs text-emerald-100 font-medium mt-1">
              સુરક્ષિત સ્ટાફ અને માલિક કંટ્રોલ પોર્ટલ
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs font-semibold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Two-Factor Mobile Authentication Required</span>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Enter Mobile Number */}
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Registered Mobile (નોંધાયેલ મોબાઇલ)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center gap-1 text-slate-500 font-bold text-sm">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="98765 43210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-20 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-extrabold text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                      autoFocus
                      required
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Enter the authorized mobile number of the Owner or Manager.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || mobile.replace(/\D/g, '').length !== 10}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Send Login OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* STEP 2: Enter 6-Digit OTP */
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Enter 6-Digit OTP
                    </label>
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setError(null); }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                    >
                      Change Number
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">
                    Verification code sent to <strong>+91 {mobile}</strong>
                  </p>

                  <div className="flex justify-center gap-2 sm:gap-2.5">
                    {otp.map((d, idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength={1}
                        inputMode="numeric"
                        value={d}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const newOtp = [...otp];
                          newOtp[idx] = val;
                          setOtp(newOtp);
                          if (val && idx < 5) {
                            const nextInput = document.getElementById(`admin-otp-${idx + 1}`);
                            nextInput?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
                            const prevInput = document.getElementById(`admin-otp-${idx - 1}`);
                            prevInput?.focus();
                          }
                        }}
                        id={`admin-otp-${idx}`}
                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-black bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <div className="mt-3 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-xs text-emerald-800 font-semibold">
                    🔑 Test OTP: <strong>123456</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Didn&apos;t receive code?</span>
                  {resendTimer > 0 ? (
                    <span className="font-mono text-slate-400">Resend in {resendTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setResendTimer(30)}
                      className="font-bold text-emerald-600 hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || otp.join('').length !== 6}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify &amp; Enter Admin HQ</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Back to Customer Store Link */}
            <div className="pt-3 border-t border-slate-100 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
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

  // Authorized Admin/Staff
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {children}
    </div>
  );
}
