import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, ShieldCheck, ShoppingBag, ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
export const metadata: Metadata = {
  title: 'Fresh Fruits & Vegetables Delivery in Halol | Taji Tokri (તાજી ટોકરી)',
  description: 'Taji Tokri delivers fresh fruits and vegetables across Halol Town, Baska GIDC, Pavagadh Bypass, and surrounding colonies in the 10 AM–1 PM delivery window.',
  keywords: [
    'fresh fruits Halol',
    'fresh vegetables Halol',
    'fruit delivery Halol',
    'vegetable delivery Halol',
    'fruits and vegetables delivery Halol',
    'online fruits Halol',
    'online vegetables Halol',
    'Baska GIDC vegetable delivery',
    'Pavagadh fruits delivery',
    'Taji Tokri Halol delivery areas',
  ],
};

const HALOL_AREAS = [
  { nameEn: 'Halol Town Center', nameGu: 'હાલોલ શહેર કેન્દ્ર', postal: '389350' },
  { nameEn: 'Baska GIDC & Industrial Area', nameGu: 'બાસ્કા જીઆઈડીસી', postal: '389350' },
  { nameEn: 'Pavagadh Bypass & Highway Road', nameGu: 'પાવાગઢ બાયપાસ રોડ', postal: '389350' },
  { nameEn: 'Godhra Highway & Surrounding Colonies', nameGu: 'ગોધરા હાઇવે', postal: '389350' },
  { nameEn: 'Kanjari Road & Residential Societies', nameGu: 'કંજરી રોડ', postal: '389350' },
  { nameEn: 'Radhe Shyam Society & Gokul Dham', nameGu: 'રાધે શ્યામ સોસાયટી', postal: '389350' },
  { nameEn: 'Gayatri Nagar & Shanti Nagar', nameGu: 'ગાયત્રી નગર', postal: '389350' },
  { nameEn: 'Vadodara Highway Corridor', nameGu: 'વડોદરા હાઇવે કોરિડોર', postal: '389350' },
];

export default function HalolDeliveryAreaPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo size="lg" showGujarati={true} showTagline={true} />
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white pt-2">
            Fresh Fruits &amp; Vegetables Delivery in Halol
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Taji Tokri (તાજી ટોકરી) delivers handpicked fruits and farm-fresh vegetables across Halol, Panchmahal, Gujarat.
          </p>
        </div>

        {/* Key Delivery Facts Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div className="font-display font-bold text-sm text-slate-900 dark:text-white">Delivery Window</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every day from <strong>10:00 AM to 1:00 PM</strong>. Orders placed before 7:50 PM are scheduled for next-day delivery.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-[#ee8a2f]/15 text-[#ee8a2f] flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="font-display font-bold text-sm text-slate-900 dark:text-white">Minimum Order</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Free delivery on minimum merchandise subtotal of <strong>₹200</strong> with Cash on Delivery (COD).
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-[#e0453a]/15 text-[#e0453a] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="font-display font-bold text-sm text-slate-900 dark:text-white">Quality Guarantee</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              100% replacement and instant refund if any vegetable or fruit does not meet your expectations.
            </p>
          </div>
        </div>

        {/* Covered Localities in Halol */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Areas &amp; Localities Served in Halol (ડિલિવરી વિસ્તારો)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We provide direct doorstep delivery across the following residential and commercial sectors in Halol:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {HALOL_AREAS.map((area, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">{area.nameEn}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{area.nameGu}</div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                  {area.postal}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="relative overflow-hidden bg-[#0d3020] text-white p-6 sm:p-8 rounded-3xl space-y-4 border border-emerald-800/60">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#ee8a2f]/10 blur-3xl pointer-events-none" aria-hidden="true" />
          <h2 className="relative font-display text-lg sm:text-xl font-bold text-emerald-100">
            How Taji Tokri Delivery Works (ઓર્ડર અને ડિલિવરી પ્રોસેસ)
          </h2>
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="text-[#f6a94a] font-mono font-black text-sm">Step 1</div>
              <div className="font-bold text-white">Shop Online (ઓર્ડર કરો)</div>
              <p className="text-emerald-200/80 text-[11px]">Select your fruits and vegetables on Taji Tokri and confirm via OTP.</p>
            </div>
            <div className="space-y-1">
              <div className="text-[#f6a94a] font-mono font-black text-sm">Step 2</div>
              <div className="font-bold text-white">Midnight Mandi Sourcing</div>
              <p className="text-emerald-200/80 text-[11px]">Our team procures fresh grade-A produce directly from APMC mandi.</p>
            </div>
            <div className="space-y-1">
              <div className="text-[#f6a94a] font-mono font-black text-sm">Step 3</div>
              <div className="font-bold text-white">Doorstep Delivery</div>
              <p className="text-emerald-200/80 text-[11px]">Delivered fresh with Cash on Delivery and WhatsApp live status updates.</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[linear-gradient(135deg,#0f7a45_0%,#0a5c35_100%)] hover:brightness-110 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 text-sm transition-all cursor-pointer"
          >
            <span>Start Shopping Fresh Fruits &amp; Vegetables (ઓર્ડર કરો)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </div>
  );
}
