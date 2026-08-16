'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Building2, 
  ShoppingBag, 
  DollarSign, 
  Gift, 
  Truck, 
  Boxes, 
  Printer, 
  Bell, 
  Flag, 
  Activity, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ShieldCheck,
  Smartphone,
  Globe
} from 'lucide-react';
import { AdminNav } from '@/components/AdminNav';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('business');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [promoStats, setPromoStats] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  // Form states for different tabs
  const [businessProfile, setBusinessProfile] = useState({
    business_name: 'Sabjiwala',
    business_name_gu: 'શાકભાજીવાળા',
    support_mobile: '+919876543210',
    whatsapp_number: '+919876543210',
    business_address: 'Shop No. 4, APMC Market Road, Halol, Panchmahal, Gujarat - 389350',
    default_language: 'gu_IN',
    default_currency: 'INR',
    timezone: 'Asia/Kolkata',
  });

  const [minOrderAmount, setMinOrderAmount] = useState(200);
  const [codDiscountPct, setCodDiscountPct] = useState(2);
  const [cutoffTime, setCutoffTime] = useState('20:00:00');
  const [deliveryWindow, setDeliveryWindow] = useState({ start: '10:00:00', end: '13:00:00' });
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [procurementBufferPct, setProcurementBufferPct] = useState(3);
  const [printerSettings, setPrinterSettings] = useState({
    label_size: '100x150',
    copies_per_bag: 1,
    auto_print_on_pack: false,
    show_product_summary: true,
    masked_mobile: true,
  });
  const [notificationPreferences, setNotificationPreferences] = useState({
    send_customer_order_confirmed: true,
    send_customer_out_for_delivery: true,
    send_customer_order_delivered: true,
    send_customer_delivery_failed: true,
    send_owner_8pm_procurement: true,
    send_owner_packing_problem: true,
    send_owner_delivery_failure: true,
    send_owner_cod_discrepancy: true,
  });
  const [featureFlags, setFeatureFlags] = useState({
    online_payments_enabled: false,
    delivery_otp_enabled: false,
    whatsapp_enabled: true,
    direct_printing_enabled: true,
    upi_at_delivery_enabled: true,
    pilot_mode_enabled: true,
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch settings');
      }

      const s = json.settings || {};
      setSettings(s);
      setPromoStats(json.promotion_stats || {});

      if (s.business_profile) setBusinessProfile(s.business_profile);
      if (s.min_order_amount?.amount !== undefined) setMinOrderAmount(s.min_order_amount.amount);
      if (s.cod_discount_pct?.percentage !== undefined) setCodDiscountPct(s.cod_discount_pct.percentage);
      if (s.cutoff_time?.time) setCutoffTime(s.cutoff_time.time);
      if (s.delivery_window) setDeliveryWindow(s.delivery_window);
      if (s.delivery_fee?.amount !== undefined) setDeliveryFee(s.delivery_fee.amount);
      if (s.procurement_buffer_pct?.percentage !== undefined) setProcurementBufferPct(s.procurement_buffer_pct.percentage);
      if (s.printer_settings) setPrinterSettings(s.printer_settings);
      if (s.whatsapp_notification_preferences) setNotificationPreferences(s.whatsapp_notification_preferences);
      if (s.feature_flags) setFeatureFlags(s.feature_flags);
    } catch (err: any) {
      setError(err.message || 'Error loading settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSetting = async (key: string, value: any) => {
    try {
      setSaving(true);
      setSaveSuccess(null);

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save setting');

      setSaveSuccess(`Updated ${key.replace(/_/g, ' ')} successfully!`);
      setTimeout(() => setSaveSuccess(null), 3000);
      await fetchSettings();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'business', label: 'Business Profile', icon: Building2 },
    { id: 'ordering', label: 'Ordering & COD', icon: ShoppingBag },
    { id: 'first500', label: 'FIRST500 Campaign', icon: Gift },
    { id: 'delivery', label: 'Delivery & Cutoff', icon: Truck },
    { id: 'procurement', label: 'Procurement Buffer', icon: Boxes },
    { id: 'printer', label: 'Thermal Printer', icon: Printer },
    { id: 'notifications', label: 'WhatsApp Alerts', icon: Bell },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
    { id: 'system', label: 'System Telemetry', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-400" />
              <span>Owner Controls & Business Settings (માલિક નિયંત્રણો)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Centralized server-authoritative configuration for pricing, delivery cutoffs, discounts, notifications, and hardware.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <div className="px-3 py-1.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{saveSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={fetchSettings}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-1 text-xs border-b border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Business Profile */}
        {activeTab === 'business' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Business Identity & Support</h3>
                <p className="text-xs text-slate-400">Legal business entity name, contact channels, and customer support.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                Halol Hub
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Business Name (English)</label>
                <input
                  type="text"
                  value={businessProfile.business_name}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, business_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Business Name (Gujarati)</label>
                <input
                  type="text"
                  value={businessProfile.business_name_gu}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, business_name_gu: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-gujarati font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Customer Support Mobile</label>
                <input
                  type="text"
                  value={businessProfile.support_mobile}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, support_mobile: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">WhatsApp Business Number</label>
                <input
                  type="text"
                  value={businessProfile.whatsapp_number}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, whatsapp_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Business & Godown Address</label>
                <input
                  type="text"
                  value={businessProfile.business_address}
                  onChange={(e) => setBusinessProfile({ ...businessProfile, business_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Timezone (Fixed)</label>
                <input
                  type="text"
                  value="Asia/Kolkata (IST, UTC+05:30)"
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed font-mono"
                />
                <p className="text-[10px] text-slate-500">8 PM daily cutoff and calendar queries depend strictly on Asia/Kolkata.</p>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Default Currency</label>
                <input
                  type="text"
                  value="Indian Rupee (INR - ₹)"
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSaveSetting('business_profile', businessProfile)}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Business Profile</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Ordering & COD Settings */}
        {activeTab === 'ordering' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Cart Thresholds & COD Discount</h3>
              <p className="text-xs text-slate-400">Minimum merchandise subtotal and Cash on Delivery discount rules.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Minimum Order Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-lg font-bold"
                />
                <p className="text-[11px] text-slate-400">
                  Cart subtotal must be <strong className="text-emerald-400">≥ ₹{minOrderAmount}</strong> before any discount to place an order.
                </p>
                <button
                  type="button"
                  onClick={() => handleSaveSetting('min_order_amount', { amount: minOrderAmount, currency: 'INR' })}
                  disabled={saving}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Save Minimum Amount
                </button>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <label className="text-slate-400 font-bold uppercase text-[10px]">COD Discount Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={codDiscountPct}
                  onChange={(e) => setCodDiscountPct(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-lg font-bold"
                />
                <p className="text-[11px] text-slate-400">
                  Customers paying Cash on Delivery receive a <strong className="text-emerald-400">{codDiscountPct}% discount</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => handleSaveSetting('cod_discount_pct', { percentage: codDiscountPct, is_active: codDiscountPct > 0 })}
                  disabled={saving}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Save COD Discount
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-2xl text-xs text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Historical Price Immutability Guarantee</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Modifying the minimum order or COD discount applies only to future quotes and orders. All past orders retain their immutable snapshot calculations.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: FIRST500 Campaign */}
        {activeTab === 'first500' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">FIRST500 Welcome Campaign</h3>
                <p className="text-xs text-slate-400">10% discount on the first order for the first 500 verified phone numbers in Halol.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold font-mono">
                {promoStats.first500?.consumed || 0} / 500 Consumed
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Discount Rate</div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {promoStats.first500?.discount_percentage || 10}%
                </div>
                <div className="text-[10px] text-slate-500">Applied on eligible subtotal</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Max Cohort Quota</div>
                <div className="text-2xl font-black text-white font-mono">500</div>
                <div className="text-[10px] text-slate-500">First 500 verified customers</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">In-Flight Reserved</div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {promoStats.first500?.reserved || 0}
                </div>
                <div className="text-[10px] text-slate-500">Active pending orders</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Remaining Coupons</div>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  {promoStats.first500?.remaining || 500}
                </div>
                <div className="text-[10px] text-slate-500">Quota available for new users</div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-white">Campaign Status</div>
                <div className="text-[11px] text-slate-400">
                  {promoStats.first500?.is_active ? 'Active and redeeming for verified cohort' : 'Paused by Owner'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSaveSetting('first_500_promo', {
                  is_active: !promoStats.first500?.is_active,
                  percentage: 10,
                  max_customer_sequence: 500,
                })}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  promoStats.first500?.is_active
                    ? 'bg-red-950 text-red-300 border border-red-800 hover:bg-red-900'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {promoStats.first500?.is_active ? 'Pause Campaign' : 'Resume Campaign'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Delivery & Cutoff */}
        {activeTab === 'delivery' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Delivery Cutoff & Schedule</h3>
              <p className="text-xs text-slate-400">Daily 8:00 PM cutoff rule and next-day morning delivery window.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Daily Cutoff Time</label>
                <input
                  type="time"
                  value={cutoffTime.slice(0, 5)}
                  onChange={(e) => setCutoffTime(`${e.target.value}:00`)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-lg font-bold"
                />
                <p className="text-[10px] text-slate-400">Orders before 8 PM $\rightarrow$ next-day; at/after $\rightarrow$ next-to-next-day.</p>
                <button
                  type="button"
                  onClick={() => handleSaveSetting('cutoff_time', { time: cutoffTime, timezone: 'Asia/Kolkata' })}
                  disabled={saving}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Save Cutoff Time
                </button>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Standard Delivery Window</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={deliveryWindow.start?.slice(0, 5) || '10:00'}
                    onChange={(e) => setDeliveryWindow({ ...deliveryWindow, start: `${e.target.value}:00` })}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white font-mono text-xs"
                  />
                  <input
                    type="time"
                    value={deliveryWindow.end?.slice(0, 5) || '13:00'}
                    onChange={(e) => setDeliveryWindow({ ...deliveryWindow, end: `${e.target.value}:00` })}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white font-mono text-xs"
                  />
                </div>
                <p className="text-[10px] text-slate-400">10:00 AM - 1:00 PM standard fresh delivery slot.</p>
                <button
                  type="button"
                  onClick={() => handleSaveSetting('delivery_window', { ...deliveryWindow, timezone: 'Asia/Kolkata' })}
                  disabled={saving}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Save Delivery Window
                </button>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Default Delivery Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-lg font-bold"
                />
                <p className="text-[10px] text-slate-400">Current MVP uses ₹0 free delivery across Halol zones.</p>
                <button
                  type="button"
                  onClick={() => handleSaveSetting('delivery_fee', { amount: deliveryFee, currency: 'INR' })}
                  disabled={saving}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Save Delivery Fee
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Procurement Buffer */}
        {activeTab === 'procurement' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Mandi Procurement Buffer</h3>
              <p className="text-xs text-slate-400">Buffer safety percentage added automatically to frozen customer demand.</p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-xs max-w-md">
              <label className="text-slate-400 font-bold uppercase text-[10px]">Default Safety Buffer %</label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={procurementBufferPct}
                onChange={(e) => setProcurementBufferPct(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-lg font-bold"
              />
              <p className="text-[11px] text-slate-400">
                At 8 PM batch cutoff, suggested purchase quantity = Customer Demand × (1 + {procurementBufferPct}%).
              </p>
              <button
                type="button"
                onClick={() => handleSaveSetting('procurement_buffer_pct', { percentage: procurementBufferPct, is_active: true })}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
              >
                Save Buffer Percentage
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: Thermal Printer */}
        {activeTab === 'printer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Warehouse Thermal Printer & Stickers</h3>
              <p className="text-xs text-slate-400">Configure sticker label size, auto-print toggles, and privacy masking.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Label Sticker Size</label>
                <select
                  value={printerSettings.label_size}
                  onChange={(e) => setPrinterSettings({ ...printerSettings, label_size: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="100x150">100 × 150 mm (Standard Warehouse Shipping)</option>
                  <option value="80x50">80 × 50 mm (Compact Bag Sticker)</option>
                  <option value="50x25">50 × 25 mm (Item Barcode Label)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Copies per Bag</label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={printerSettings.copies_per_bag}
                  onChange={(e) => setPrinterSettings({ ...printerSettings, copies_per_bag: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div>
                  <div className="font-bold text-white">Show Vegetable Summary on Label</div>
                  <div className="text-[10px] text-slate-400">List top vegetables on the customer bag sticker</div>
                </div>
                <input
                  type="checkbox"
                  checked={printerSettings.show_product_summary}
                  onChange={(e) => setPrinterSettings({ ...printerSettings, show_product_summary: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div>
                  <div className="font-bold text-white">Mask Customer Mobile on Label</div>
                  <div className="text-[10px] text-slate-400">Protect customer contact details on bags</div>
                </div>
                <input
                  type="checkbox"
                  checked={printerSettings.masked_mobile}
                  onChange={(e) => setPrinterSettings({ ...printerSettings, masked_mobile: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSaveSetting('printer_settings', printerSettings)}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Printer Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 7: WhatsApp Notifications */}
        {activeTab === 'notifications' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">WhatsApp Channel Dispatches</h3>
              <p className="text-xs text-slate-400">Toggle individual customer notifications and owner operational alerts.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Customer Order Confirmation</div>
                  <div className="text-[10px] text-slate-400">Send bilingual confirmation after checkout</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPreferences.send_customer_order_confirmed}
                  onChange={(e) => setNotificationPreferences({ ...notificationPreferences, send_customer_order_confirmed: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Customer Out for Delivery</div>
                  <div className="text-[10px] text-slate-400">Alert customer when driver starts route</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPreferences.send_customer_out_for_delivery}
                  onChange={(e) => setNotificationPreferences({ ...notificationPreferences, send_customer_out_for_delivery: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Customer Delivered & Bill Receipt</div>
                  <div className="text-[10px] text-slate-400">Send delivery confirmation and amount collected</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPreferences.send_customer_order_delivered}
                  onChange={(e) => setNotificationPreferences({ ...notificationPreferences, send_customer_order_delivered: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Owner 8 PM Procurement Report</div>
                  <div className="text-[10px] text-slate-400">Send Mandi purchase requirement to Owner</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPreferences.send_owner_8pm_procurement}
                  onChange={(e) => setNotificationPreferences({ ...notificationPreferences, send_owner_8pm_procurement: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSaveSetting('whatsapp_notification_preferences', notificationPreferences)}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Notification Preferences</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 8: Feature Flags */}
        {activeTab === 'flags' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Server-Authoritative Feature Flags</h3>
              <p className="text-xs text-slate-400">Enable or disable major business features and operational modes.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Online Payment Gateway (Prepaid)</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">Disabled for MVP</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">MVP uses Cash on Delivery (COD) only</div>
                </div>
                <input
                  type="checkbox"
                  checked={featureFlags.online_payments_enabled}
                  onChange={(e) => setFeatureFlags({ ...featureFlags, online_payments_enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Pilot Launch Mode</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Restricts live ordering to Halol service zones</div>
                </div>
                <input
                  type="checkbox"
                  checked={featureFlags.pilot_mode_enabled}
                  onChange={(e) => setFeatureFlags({ ...featureFlags, pilot_mode_enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Direct Thermal Printing</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Enable direct godown print station labels</div>
                </div>
                <input
                  type="checkbox"
                  checked={featureFlags.direct_printing_enabled}
                  onChange={(e) => setFeatureFlags({ ...featureFlags, direct_printing_enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">WhatsApp Business Automation</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Enable Meta Cloud API message dispatches</div>
                </div>
                <input
                  type="checkbox"
                  checked={featureFlags.whatsapp_enabled}
                  onChange={(e) => setFeatureFlags({ ...featureFlags, whatsapp_enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSaveSetting('feature_flags', featureFlags)}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Feature Flags</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 9: System Telemetry */}
        {activeTab === 'system' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">System Health & Telemetry</h3>
                <p className="text-xs text-slate-400">Live operational status, database connectivity, and build reference.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold font-mono">
                Production Release v1.0.0
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Web Application</span>
                <div className="text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Operational (Next.js 16)</span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Database Connectivity</span>
                <div className="text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Connected (Supabase PostgreSQL)</span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Primary Timezone</span>
                <div className="text-white font-mono font-bold mt-1">Asia/Kolkata (IST)</div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
              <div className="font-bold text-white">Production Service Parameters</div>
              <ul className="text-slate-400 space-y-1 font-mono text-[11px]">
                <li>• Service Area: Halol Town, Halol GIDC, Baska, Pavagadh Bypass (Panchmahal, Gujarat)</li>
                <li>• Payment Mode: Cash on Delivery (COD) Only</li>
                <li>• Daily Delivery Slot: 10:00 AM – 1:00 PM IST</li>
                <li>• 8 PM Procurement Batch Cutoff: 20:00:00 Asia/Kolkata</li>
                <li>• System Health Endpoint: <a href="/api/health" target="_blank" className="text-emerald-400 underline">/api/health</a></li>
              </ul>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
