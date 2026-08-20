'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, X, Gift } from 'lucide-react';
import { CampaignSettings } from '@/types/sabjiwala';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export function PromoCountdownBanner({ initialCampaign }: { initialCampaign?: CampaignSettings }) {
  const [campaign, setCampaign] = useState<CampaignSettings | null>(initialCampaign || null);
  const [loading, setLoading] = useState(!initialCampaign);
  const [isDismissed, setIsDismissed] = useState(false);

  const calculateTimeLeft = useCallback((targetDateStr: string): TimeLeft => {
    try {
      const difference = new Date(targetDateStr).getTime() - new Date().getTime();
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false,
      };
    } catch {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
  }, []);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => {
    if (initialCampaign?.valid_until) {
      const diff = new Date(initialCampaign.valid_until).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        isExpired: false,
      };
    }
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false };
  });

  useEffect(() => {
    async function loadCampaign() {
      try {
        const res = await fetch('/api/campaign');
        const json = await res.json();
        if (json.success && json.campaign) {
          setCampaign(json.campaign);
        }
      } catch (err) {
        console.error('Failed to load campaign info:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!initialCampaign) {
      loadCampaign();
    }
  }, [initialCampaign]);

  // Live Timer Interval
  useEffect(() => {
    if (!campaign?.valid_until || !campaign.is_active) return;

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(campaign.valid_until);
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [campaign, calculateTimeLeft]);

  if (isDismissed || loading || !campaign || !campaign.is_active || timeLeft.isExpired) {
    return null;
  }

  const discountVal = campaign.discount_percentage || 10;
  const maxOrders = campaign.max_orders_per_customer || 3;
  const maxSeq = campaign.max_verified_customer_seq || 500;

  return (
    <div className="relative z-30 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white border-b border-emerald-500/20 shadow-xs">
      
      {/* 📱 Mobile Compact Strip (< sm) */}
      <div className="sm:hidden flex items-center justify-between px-3 py-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 truncate">
          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shrink-0">
            {discountVal}% OFF
          </span>
          <span className="truncate font-semibold text-emerald-100 text-[11px]">
            FIRST{maxSeq} • First {maxOrders} Orders
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-amber-300 font-bold pl-2">
          <span>{timeLeft.days}d:{String(timeLeft.hours).padStart(2, '0')}h:{String(timeLeft.minutes).padStart(2, '0')}m</span>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss banner"
            className="text-slate-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 💻 Desktop Full Banner (>= sm) */}
      <div className="hidden sm:flex max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-2.5 items-center justify-between gap-4 text-xs">
        {/* Left Side: Campaign Offer Highlight */}
        <div className="flex items-center space-x-3 text-left">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-sm">
            <Gift className="w-3 h-3 animate-bounce" />
            <span>Launch Offer</span>
          </div>

          <div className="text-xs font-semibold text-emerald-100 flex items-center gap-1.5 flex-wrap">
            <span>
              First <strong className="text-amber-300 font-extrabold">{maxSeq}</strong> Halol customers get{' '}
              <strong className="text-amber-300 font-extrabold">{discountVal}% OFF</strong> on their first{' '}
              <strong className="text-white underline decoration-amber-400 font-extrabold">{maxOrders} orders</strong>!
            </span>
            <span className="hidden lg:inline text-emerald-400/70 text-[11px]">
              (પ્રથમ {maxOrders} ઓર્ડર પર {discountVal}% છૂટ)
            </span>
          </div>
        </div>

        {/* Right Side: Live Countdown Clock & Dismiss Button */}
        <div className="flex items-center space-x-3">
          {campaign.show_timer && (
            <div className="flex items-center space-x-1.5 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-xl border border-emerald-500/30 text-[11px] font-mono font-bold shadow-inner">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse mr-1" />
              <span className="text-slate-400 text-[10px] mr-1">Offer Ends:</span>
              
              <div className="flex items-center">
                <span className="text-amber-300 font-extrabold">{String(timeLeft.days).padStart(2, '0')}</span>
                <span className="text-slate-400 text-[9px] ml-0.5 mr-1">d</span>
              </div>
              <span className="text-slate-600">:</span>
              
              <div className="flex items-center">
                <span className="text-emerald-300 font-extrabold">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-slate-400 text-[9px] ml-0.5 mr-1">h</span>
              </div>
              <span className="text-slate-600">:</span>
              
              <div className="flex items-center">
                <span className="text-emerald-300 font-extrabold">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-slate-400 text-[9px] ml-0.5 mr-1">m</span>
              </div>
              <span className="text-slate-600">:</span>
              
              <div className="flex items-center">
                <span className="text-amber-400 font-extrabold animate-pulse">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="text-slate-400 text-[9px] ml-0.5">s</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 rounded-lg text-emerald-400/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
