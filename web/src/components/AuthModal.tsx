'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  Phone, 
  ShieldCheck, 
  MapPin, 
  User, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2
} from 'lucide-react';

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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 dark:border-slate-800 animate-scaleUp flex flex-col max-h-[90vh]">
        
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">
                {step === 'phone' && 'Welcome to Sabjiwala'}
                {step === 'otp' && 'Verify Phone Number'}
                {step === 'onboarding' && 'Complete Delivery Profile'}
                {step === 'success' && 'Welcome Back!'}
              </h3>
              <p className="text-xs text-emerald-100">
                {step === 'phone' && 'Fresh Vegetables Delivered Daily in Halol'}
                {step === 'otp' && `OTP sent to +91 ${mobile}`}
                {step === 'onboarding' && 'One-time details for lightning-fast daily orders'}
                {step === 'success' && 'Your profile is ready'}
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            aria-label="Close authentication modal"
            className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* First 500 Promo Badge */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-800/40 px-6 py-2.5 flex items-center space-x-2 text-amber-900 dark:text-amber-300 text-xs font-medium shrink-0">
          <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold text-[10px] tracking-wide uppercase shadow-sm">
            Launch Offer
          </span>
          <span>First 500 verified customers in Halol get <strong>10% OFF</strong> on their first order with FIRST500!</span>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1">

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-start space-x-3 text-red-700 dark:text-red-300 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Phone Number */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Mobile Number (મોબાઇલ નંબર)
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 font-medium">
                    <span className="text-lg">🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-24 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-medium text-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400 min-h-[48px]"
                    autoFocus
                    required
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  We will send a 6-digit OTP to verify your phone number.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || mobile.length !== 10}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed min-h-[48px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with OTP</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: 6-Digit OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 text-center">
                  Enter 6-Digit Verification Code
                </label>
                <div className="flex justify-center gap-2 sm:gap-3">
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
                      className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors min-h-[32px] px-2 cursor-pointer"
                >
                  Change mobile number
                </button>
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors min-h-[32px] px-2 cursor-pointer"
                  >
                    Resend OTP
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    Resend in <strong>{timer}s</strong>
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed min-h-[48px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: First-time Customer Onboarding */}
          {step === 'onboarding' && (
            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/50 flex items-center space-x-3 text-emerald-900 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phone verified! Complete your profile once for seamless 1-click orders.</span>
              </div>

              {/* Personal Info */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name (પૂરું નામ) *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Rameshbhai Patel"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Alternate Mobile (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="e.g. 9876543211"
                        value={alternateMobile}
                        onChange={(e) => setAlternateMobile(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address in Halol */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Delivery Address (હલોલ ડિલિવરી સરનામું)
                  </span>
                  <div className="flex space-x-1">
                    {(['home', 'work', 'temporary'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAddressType(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all min-h-[32px] cursor-pointer ${
                          addressType === t
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Flat / House / Bungalow No. (e.g. B-402, Gokul Dham)"
                    value={flatHouseNo}
                    onChange={(e) => setFlatHouseNo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                    required
                  />

                  <input
                    type="text"
                    placeholder="Society / Street / Complex (e.g. Godhra Road / Pavagadh Bypass)"
                    value={societyStreetName}
                    onChange={(e) => setSocietyStreetName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Landmark (e.g. Near Bus Stand)"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                      required
                    />

                    <input
                      type="text"
                      placeholder="Area / Locality (e.g. Kanjari Area)"
                      value={areaLocality}
                      onChange={(e) => setAreaLocality(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value="Halol"
                      disabled
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 min-h-[44px]"
                    />
                    <input
                      type="text"
                      value="Panchmahal"
                      disabled
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 min-h-[44px]"
                    />
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="389350"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all cursor-pointer mt-4 min-h-[48px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Start Ordering</span>
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: Success Greeting & Launch Promo */}
          {step === 'success' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-inner animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-white">
                {customer?.full_name ? `Welcome, ${customer.full_name}!` : 'Login Successful!'}
              </h4>
              {verifiedSeq && verifiedSeq <= 500 && (
                <div className="p-4 bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-amber-900 dark:text-amber-200 text-sm font-semibold">
                  🎉 Congratulations! You are verified customer <strong>#{verifiedSeq}</strong>!
                  <div className="text-xs font-normal text-amber-800 dark:text-amber-300 mt-1">
                    Your 10% Launch Discount on your first order with FIRST500 has been unlocked!
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saved address loaded. Redirecting to your cart...
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
