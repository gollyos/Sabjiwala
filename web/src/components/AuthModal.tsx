'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  Phone, 
  ShieldCheck, 
  MapPin, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Leaf
} from 'lucide-react';
import { BrandLogo } from './ui/BrandLogo';

export function AuthModal() {
  const { 
    authModalOpen, 
    closeAuthModal, 
    sendOtp, 
    verifyOtp, 
    completeOnboarding,
    isOnboarded,
    customer 
  } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp' | 'onboarding' | 'success'>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoOtp, setIsDemoOtp] = useState(false);
  const [verifiedSeq, setVerifiedSeq] = useState<number | null>(null);

  // Onboarding Form State
  const [fullName, setFullName] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [email, setEmail] = useState('');
  const [addressType, setAddressType] = useState<'home' | 'work' | 'temporary'>('home');
  const [flatHouseNo, setFlatHouseNo] = useState('');
  const [societyStreetName, setSocietyStreetName] = useState('');
  const [landmark, setLandmark] = useState('');
  const [areaLocality, setAreaLocality] = useState('');
  const [pincode, setPincode] = useState('389350');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset when opening modal
  useEffect(() => {
    if (authModalOpen) {
      if (isOnboarded && customer) {
        setStep('success');
      } else {
        setStep('phone');
      }
      setError(null);
      setLoading(false);
      setIsDemoOtp(false);
      setOtp(['', '', '', '', '', '']);
    }
  }, [authModalOpen, isOnboarded, customer]);

  // OTP Countdown Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!authModalOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = mobile.replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    const res = await sendOtp(cleanNumber);
    setLoading(false);

    if (res.success) {
      if (res.isDevMode) {
        setIsDemoOtp(true);
      }
      setStep('otp');
      setTimer(30);
      setCanResend(false);
    } else {
      setError(res.error || 'Failed to send OTP. Please try again.');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste of complete 6-digit OTP
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      pastedDigits.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);
      const nextFocus = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.join('');
    if (token.length !== 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }

    setLoading(true);
    setError(null);
    const res = await verifyOtp(mobile, token);
    setLoading(false);

    if (res.success) {
      if (res.isOnboarded) {
        setStep('success');
        setTimeout(() => {
          closeAuthModal();
        }, 1500);
      } else {
        setStep('onboarding');
      }
    } else {
      setError(res.error || 'Invalid OTP. Please check and try again.');
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setLoading(true);
    setError(null);
    const res = await sendOtp(mobile);
    setLoading(false);
    if (res.success) {
      setTimer(30);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
    } else {
      setError(res.error || 'Failed to resend OTP.');
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!flatHouseNo.trim() || !societyStreetName.trim() || !landmark.trim() || !areaLocality.trim()) {
      setError('Please complete all required delivery address fields in Halol.');
      return;
    }

    setLoading(true);
    setError(null);
    const res = await completeOnboarding({
      fullName: fullName.trim(),
      alternateMobile: alternateMobile.trim() || undefined,
      email: email.trim() || undefined,
      addressType,
      flatHouseNo: flatHouseNo.trim(),
      societyStreetName: societyStreetName.trim(),
      landmark: landmark.trim(),
      areaLocality: areaLocality.trim(),
      city: 'Halol',
      district: 'Panchmahal',
      state: 'Gujarat',
      pincode: pincode.trim() || '389350',
    });
    setLoading(false);

    if (res.success) {
      setVerifiedSeq(res.sequence ?? null);
      setStep('success');
      setTimeout(() => {
        closeAuthModal();
      }, 2500);
    } else {
      setError(res.error || 'Could not save profile. Please verify your details.');
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header Ribbon (Clean Brand Emerald) */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 sm:px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-xs border border-white/20">
              <Leaf className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight text-white">
                {step === 'phone' && 'Welcome to TaazaTokra (તાજાટોકરા)'}
                {step === 'otp' && 'Verify Phone (મોબાઇલ ચકાસણી)'}
                {step === 'onboarding' && 'Delivery Profile (સરનામું)'}
                {step === 'success' && 'Welcome Back!'}
              </h3>
              <p className="text-xs text-emerald-100/90 font-medium">
                {step === 'phone' && 'Fresh Fruits & Vegetables • Halol Delivery'}
                {step === 'otp' && `OTP sent to +91 ${mobile}`}
                {step === 'onboarding' && 'One-time address for doorstep morning delivery'}
                {step === 'success' && 'Your profile is ready'}
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            aria-label="Close authentication modal"
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* First 500 Promo Badge */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-800/40 px-5 sm:px-6 py-2 flex items-center space-x-2 text-amber-900 dark:text-amber-300 text-xs font-medium shrink-0">
          <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black text-[9px] tracking-wider uppercase shadow-2xs">
            Offer
          </span>
          <span className="text-[11px] font-semibold truncate">First 500 Halol customers get <strong>10% OFF</strong> with FIRST500!</span>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 bg-white dark:bg-slate-900">

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start space-x-2.5 text-rose-800 dark:text-rose-200 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Phone Number */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Mobile Number (મોબાઇલ નંબર)
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 font-bold text-sm">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-20 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-extrabold text-base focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    autoFocus
                    required
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>We will send a 6-digit OTP to verify your mobile number.</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || mobile.length !== 10}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black text-sm rounded-2xl shadow-xs shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: 6-Digit OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 text-center">
                  Enter 6-Digit Verification Code
                </label>
                
                {isDemoOtp && (
                  <div className="mb-3 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                    🔑 Test OTP: <strong>123456</strong>
                  </div>
                )}

                <div className="flex justify-center gap-2 sm:gap-2.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  Change mobile number
                </button>
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold transition-colors cursor-pointer"
                  >
                    Resend OTP
                  </button>
                ) : (
                  <span className="text-slate-400 font-mono">
                    Resend in {timer}s
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black text-sm rounded-2xl shadow-xs shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: Customer Onboarding */}
          {step === 'onboarding' && (
            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2.5 text-emerald-900 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phone verified! Complete your profile once for seamless 1-click orders.</span>
              </div>

              {/* Personal Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name (પૂરું નામ) *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="દા.ત. રમેશભાઈ પટેલ / Rameshbhai Patel"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Alternate Mobile (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="e.g. 9876543211"
                        value={alternateMobile}
                        onChange={(e) => setAlternateMobile(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address in Halol */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Delivery Address (સરનામું)
                  </span>
                  <div className="flex space-x-1">
                    {(['home', 'work', 'temporary'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAddressType(t)}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                          addressType === t
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Flat / House / Bungalow No. (e.g. B-402, Gokul Dham)"
                  value={flatHouseNo}
                  onChange={(e) => setFlatHouseNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                  required
                />

                <input
                  type="text"
                  placeholder="Society / Street / Complex (e.g. Godhra Road / Pavagadh Bypass)"
                  value={societyStreetName}
                  onChange={(e) => setSocietyStreetName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Landmark (e.g. Near Bus Stand)"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                    required
                  />

                  <input
                    type="text"
                    placeholder="Area / Locality (e.g. Kanjari Area)"
                    value={areaLocality}
                    onChange={(e) => setAreaLocality(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value="Halol"
                    disabled
                    className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-400"
                  />
                  <input
                    type="text"
                    value="Panchmahal"
                    disabled
                    className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-400"
                  />
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="389350"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-[11px] font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-xs shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <span>Save &amp; Start Shopping</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: Success Greeting */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-inner animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {customer?.full_name ? `Welcome, ${customer.full_name}!` : 'Login Successful!'}
              </h4>
              {verifiedSeq && verifiedSeq <= 500 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-900 dark:text-amber-200 text-xs font-semibold">
                  🎉 You are verified customer <strong>#{verifiedSeq}</strong>!
                  <div className="text-[11px] font-normal text-amber-800 dark:text-amber-300 mt-0.5">
                    Your 10% Launch Discount with FIRST500 is active.
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Redirecting to your cart...
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
