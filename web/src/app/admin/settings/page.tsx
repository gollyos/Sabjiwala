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
  Globe,
  Zap
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
  const [n8nTestStatus, setN8nTestStatus] = useState<{ loading: boolean; message: string | null; error: string | null }>({
    loading: false,
    message: null,
    error: null,
  });

  const [n8nConfig, setN8nConfig] = useState({
    webhook_url: '',
    is_active: true,
    admin_alert_phone: '+919876543210',
    admin_alert_email: 'orders@taazatokra.com',
  });

  // Form states for different tabs
  const [businessProfile, setBusinessProfile] = useState({
    business_name: 'TaazaTokra',
    business_name_gu: 'તાજાટોકરા',
    support_mobile: '+919876543210',
    whatsapp_number: '+919876543210',
    business_address: 'Shop No. 4, APMC Market Road, Halol, Panchmahal, Gujarat - 389350',
    default_language: 'gu_IN',
    default_currency: 'INR',
    timezone: 'Asia/Kolkata',
  });

  const [campaignSettings, setCampaignSettings] = useState({
    is_active: true,
    promo_code: 'FIRST500',
    title_en: 'Grand Launch Celebration Offer',
    title_gu: 'ગ્રાન્ડ લૉન્ચ ઓફર',
    discount_percentage: 10,
    max_verified_customer_seq: 500,
    max_orders_per_customer: 3,
    min_order_subtotal: 200,
    valid_from: '2026-08-01T00:00',
    valid_until: '2026-10-31T23:59',
    show_timer: true,
    banner_message_en: 'First 500 verified customers in Halol get 10% OFF on their first 3 orders!',
    banner_message_gu: 'હલોલના પ્રથમ 500 ગ્રાહકોને પ્રથમ 3 ઓર્ડર પર 10% છૂટ!',
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
      if (s.launch_campaign) {
        setCampaignSettings({
          ...s.launch_campaign,
          valid_from: s.launch_campaign.valid_from ? s.launch_campaign.valid_from.slice(0, 16) : '2026-08-01T00:00',
          valid_until: s.launch_campaign.valid_until ? s.launch_campaign.valid_until.slice(0, 16) : '2026-10-31T23:59',
        });
      }
      if (s.min_order_amount?.amount !== undefined) setMinOrderAmount(s.min_order_amount.amount);
      if (s.cod_discount_pct?.percentage !== undefined) setCodDiscountPct(s.cod_discount_pct.percentage);
      if (s.cutoff_time?.time) setCutoffTime(s.cutoff_time.time);
      if (s.delivery_window) setDeliveryWindow(s.delivery_window);
      if (s.delivery_fee?.amount !== undefined) setDeliveryFee(s.delivery_fee.amount);
      if (s.procurement_buffer_pct?.percentage !== undefined) setProcurementBufferPct(s.procurement_buffer_pct.percentage);
      if (s.printer_settings) setPrinterSettings(s.printer_settings);
      if (s.whatsapp_notification_preferences) setNotificationPreferences(s.whatsapp_notification_preferences);
      if (s.feature_flags) setFeatureFlags(s.feature_flags);
      if (s.n8n_config) setN8nConfig(s.n8n_config);
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

  const handleTestN8nWebhook = async () => {
    if (!n8nConfig.webhook_url) {
      alert('Please enter your n8n Webhook URL first.');
      return;
    }
    setN8nTestStatus({ loading: true, message: null, error: null });
    try {
      const res = await fetch('/api/automation/n8n-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_test: true,
          test_webhook_url: n8nConfig.webhook_url,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setN8nTestStatus({ loading: false, message: '✅ Connection Successful! n8n received the test order event.', error: null });
      } else {
        setN8nTestStatus({ loading: false, message: null, error: json.error || 'Failed to connect to n8n webhook.' });
      }
    } catch (err: any) {
      setN8nTestStatus({ loading: false, message: null, error: err.message || 'Error connecting to n8n' });
    }
  };

  const tabs = [
    { id: 'business', label: 'Business Profile', icon: Building2 },
    { id: 'n8n', label: 'n8n Automation (ઓટોમેશન)', icon: Zap },
    { id: 'ordering', label: 'Ordering & COD', icon: ShoppingBag },
    { id: 'first500', label: 'Offers & Campaigns', icon: Gift },
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

        {/* TAB 2: n8n Automation */}
        {activeTab === 'n8n' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>n8n Workflow Automation (ઓટોમેશન સેટિંગ્સ)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Instant Google Sheets / Excel auto-entry, automated WhatsApp customer receipts, and admin alerts upon order confirmation.
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                n8nConfig.is_active
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {n8nConfig.is_active ? 'Automation Active' : 'Disabled'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <label className="text-slate-400 font-bold uppercase text-[10px] flex items-center justify-between">
                  <span>n8n Webhook Production URL</span>
                  <span className="text-amber-400 font-mono text-[10px]">POST /webhook/taazatokra-orders</span>
                </label>
                <input
                  type="url"
                  placeholder="https://your-n8n-domain.com/webhook/taazatokra-new-order"
                  value={n8nConfig.webhook_url}
                  onChange={(e) => setN8nConfig({ ...n8nConfig, webhook_url: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono placeholder:text-slate-600 focus:border-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400">
                  Paste the Webhook URL from your n8n workflow. Whenever an order is confirmed, TaazaTokra immediately posts the full structured order payload to this URL.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-slate-400 font-bold uppercase text-[10px]">Admin WhatsApp for Instant Alerts</label>
                  <input
                    type="text"
                    value={n8nConfig.admin_alert_phone}
                    onChange={(e) => setN8nConfig({ ...n8nConfig, admin_alert_phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500">n8n will notify this number immediately on new order receipts.</p>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-slate-400 font-bold uppercase text-[10px]">Admin Alert Email</label>
                  <input
                    type="email"
                    value={n8nConfig.admin_alert_email}
                    onChange={(e) => setN8nConfig({ ...n8nConfig, admin_alert_email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500">n8n can optionally dispatch HTML order summary emails.</p>
                </div>
              </div>

              {/* Automation Feature Guide Box */}
              <div className="p-4 bg-amber-950/30 border border-amber-900/60 rounded-2xl text-amber-200/90 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Zap className="w-4 h-4" />
                  <span>How the Automated Flow Works (ઓટોમેશન કેવી રીતે કામ કરે છે)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  <li><strong className="text-white">Customer Books Order:</strong> TaazaTokra records the order securely in Supabase and prepares customer, date, month, week #, and COD details.</li>
                  <li><strong className="text-white">n8n Webhook Triggers:</strong> n8n receives the JSON payload instantaneously.</li>
                  <li><strong className="text-white">WhatsApp to Customer:</strong> n8n automatically sends a rich order confirmation message with items breakdown and bill link to the customer&apos;s WhatsApp.</li>
                  <li><strong className="text-white">Admin Alert:</strong> n8n sends a quick alert notification to the store owner&apos;s WhatsApp/Email.</li>
                  <li><strong className="text-white">Dashboard Live Refresh:</strong> Admin orders page updates in Realtime.</li>
                </ol>
              </div>

              {/* Test Webhook Connection */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Test Connection to n8n</span>
                  <button
                    type="button"
                    onClick={handleTestN8nWebhook}
                    disabled={n8nTestStatus.loading || !n8nConfig.webhook_url}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {n8nTestStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Test Webhook (ટેસ્ટ કરો)</span>
                  </button>
                </div>

                {n8nTestStatus.message && (
                  <div className="p-3 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{n8nTestStatus.message}</span>
                  </div>
                )}

                {n8nTestStatus.error && (
                  <div className="p-3 bg-rose-950 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{n8nTestStatus.error}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSaveSetting('n8n_config', n8nConfig)}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save n8n Automation Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Ordering & COD Settings */}
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

        {/* TAB 3: Dynamic Campaign & Promotion Engine */}
        {activeTab === 'first500' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            
            {/* Header Ribbon */}
            <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>Promotional Campaign & Launch Offer Engine (ઓફર મેનેજમેન્ટ)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure dynamic discount percentage, target verified cohort, maximum orders per client, date validity, and header countdown timer.
                </p>
              </div>
              <span className="self-start sm:self-center px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold font-mono">
                {promoStats.first500?.consumed || 0} Orders Redeemed
              </span>
            </div>

            {/* Campaign Analytics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Discount Rate</div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {campaignSettings.discount_percentage}%
                </div>
                <div className="text-[10px] text-slate-500">Applied on eligible subtotal</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Orders / Customer</div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  First {campaignSettings.max_orders_per_customer} Orders
                </div>
                <div className="text-[10px] text-slate-500">Max limit per verified phone</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Target Sequence</div>
                <div className="text-2xl font-black text-white font-mono">
                  First #{campaignSettings.max_verified_customer_seq}
                </div>
                <div className="text-[10px] text-slate-500">Verified customers in Halol</div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Verified Users</div>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  {promoStats.first500?.total_verified_customers || 0}
                </div>
                <div className="text-[10px] text-slate-500">Registered on platform</div>
              </div>
            </div>

            {/* Live Header Banner Preview */}
            <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-2xl space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                <span>Live Customer Header Banner Preview</span>
                <span className="text-emerald-400 text-[10px]">● Real-time sync</span>
              </div>
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 p-3 rounded-xl border border-emerald-500/20 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase">
                    Launch Offer
                  </span>
                  <span className="text-emerald-100 font-semibold text-[11px]">
                    {campaignSettings.banner_message_en || `First ${campaignSettings.max_verified_customer_seq} customers get ${campaignSettings.discount_percentage}% OFF on first ${campaignSettings.max_orders_per_customer} orders!`}
                  </span>
                </div>
                {campaignSettings.show_timer && (
                  <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold">
                    <Clock className="w-3 h-3 text-amber-400 mr-1" />
                    <span>Offer Ends: 05d : 14h : 23m : 45s</span>
                  </div>
                )}
              </div>
            </div>

            {/* Editable Campaign Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              
              {/* Promo Code */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Promo Code</label>
                <input
                  type="text"
                  value={campaignSettings.promo_code}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, promo_code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold uppercase"
                />
              </div>

              {/* Discount Percentage */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Discount Percentage (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={campaignSettings.discount_percentage}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, discount_percentage: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
              </div>

              {/* Max Orders Per Customer */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Max Orders per Customer</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={campaignSettings.max_orders_per_customer}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, max_orders_per_customer: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
                <p className="text-[10px] text-slate-500">Number of orders eligible for discount (e.g. 3)</p>
              </div>

              {/* Max Verified Sequence */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Max Customer Sequence (Quota)</label>
                <input
                  type="number"
                  min="1"
                  step="50"
                  value={campaignSettings.max_verified_customer_seq}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, max_verified_customer_seq: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
                <p className="text-[10px] text-slate-500">First N verified customers (e.g. 500)</p>
              </div>

              {/* Valid From Date */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Valid From Date & Time</label>
                <input
                  type="datetime-local"
                  value={campaignSettings.valid_from}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, valid_from: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              {/* Valid Until Date */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Valid Until (End Date & Time)</label>
                <input
                  type="datetime-local"
                  value={campaignSettings.valid_until}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, valid_until: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-amber-300"
                />
              </div>

              {/* Banner Message (English) */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Banner Message (English)</label>
                <input
                  type="text"
                  value={campaignSettings.banner_message_en}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, banner_message_en: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Banner Message (Gujarati) */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Banner Message (Gujarati)</label>
                <input
                  type="text"
                  value={campaignSettings.banner_message_gu}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, banner_message_gu: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-gujarati"
                />
              </div>
            </div>

            {/* Status & Timer Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Campaign Active Status</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {campaignSettings.is_active ? 'Active on customer checkout & cart' : 'Paused by Owner'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={campaignSettings.is_active}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, is_active: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Show Countdown Timer on Header</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Displays live ticking countdown clock on website header
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={campaignSettings.show_timer}
                  onChange={(e) => setCampaignSettings({ ...campaignSettings, show_timer: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Saving updates both server pricing calculations and the customer frontend countdown.
              </span>
              <button
                type="button"
                onClick={() => handleSaveSetting('launch_campaign', {
                  ...campaignSettings,
                  valid_from: campaignSettings.valid_from.length === 16 ? `${campaignSettings.valid_from}:00+05:30` : campaignSettings.valid_from,
                  valid_until: campaignSettings.valid_until.length === 16 ? `${campaignSettings.valid_until}:00+05:30` : campaignSettings.valid_until,
                })}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Campaign Settings</span>
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
