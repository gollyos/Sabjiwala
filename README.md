# Taji Tokri (તાજી ટોકરી) — Fresh Fruits & Vegetables Delivery Platform

> **Taaza Phal, Taazi Sabzi — Seedha Ghar Tak.**  
> *તાજા ફળ, તાજું શાક — સીધું તમારા ઘર સુધી.*  
> **Pilot Market**: Halol & Baska GIDC, Panchmahal, Gujarat (389350)

---

## 🌟 Overview
**Taji Tokri** is a production-ready, full-stack fresh agricultural produce e-commerce and logistics management platform engineered for morning doorstep deliveries in Halol, Gujarat.

The system connects consumer ordering, midnight APMC Mandi procurement, godown packing, driver delivery routes, real-time reporting, and automated WhatsApp communication via n8n.

---

## 🏗️ Architecture & Portals

```
                             [ Customer Storefront (PWA) ]
                                          │
                                 (Place Order < 8 PM)
                                          │
                                          ▼
                               [ Supabase Database ]
                                    │           │
                    (Webhook Trigger)           (Realtime Sync)
                                    │           │
                                    ▼           ▼
                         [ n8n Automation ]  [ Admin HQ ] ──► [ Procurement Mandi Sheet ]
                           │          │                              │
          (WhatsApp Bill)  │          │ (Admin Alert)                ▼
                           ▼          ▼                      [ Godown Packing ]
                       [Customer]  [Owner]                           │
                                                                     ▼
                                                             [ Driver Delivery ]
```

### Integrated Portals:
1. **Customer Storefront (`/`)**: High-performance mobile-first PWA with Gujarati/English search, live category switcher (Fruits & Vegetables), ₹200 min subtotal progress indicator, and instant OTP sign-in.
2. **SEO Landing Pages (`/delivery-areas/halol`)**: Indexed locality pages with `GroceryStore` & `LocalBusiness` JSON-LD schema.
3. **Admin HQ (`/admin/dashboard`)**: Real-time sales, order counts, settlement discrepancies, and today's business KPIs.
4. **Orders Controller (`/admin/orders`)**: Live Supabase Realtime sync, date presets (*Today, Tomorrow, Week, Month*), search, and 1-click CSV exports.
5. **Mandi Procurement (`/admin/procurement`)**: Sourcing batches frozen at 8 PM with 1-click **"Copy Mandi Sheet (WhatsApp)"** for midnight APMC purchasing.
6. **Godown Packing (`/admin/packing`)**: Zero-hardware 1-click packing and standard A4/mobile PDF label generator.
7. **Driver Portal (`/driver`)**: Mobile driver screen with grouped delivery stops, Cash & UPI QR COD collection, and bag verification.
8. **Automated WhatsApp Engine (`/lib/n8n.ts`)**: Structured JSON webhook dispatcher for automated customer bills and owner alerts via n8n.

---

## ⚖️ Core Business Rules

- **Payment Mode**: Cash on Delivery (COD) / Payment on Delivery only.
- **Minimum Order Subtotal**: ₹200 merchandise minimum before discounts.
- **FIRST500 Offer**: Flat 10% discount on merchandise subtotal for the first 500 verified customers.
- **COD Discount**: 2% cash discount calculated on the remaining merchandise subtotal.
- **Order Cutoff Rule**:
  - Confirmed before **8:00:00 PM IST** $\to$ Delivered next day (**10:00 AM – 01:00 PM**).
  - Confirmed at/after **8:00:00 PM IST** $\to$ Delivered day after next (**10:00 AM – 01:00 PM**).
- **Historical Data Integrity**: Past orders, prices, invoices, and customer snapshots remain permanently locked and immutable.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+ (Node.js 24 LTS recommended)
- Supabase Project (PostgreSQL with RLS policies enabled)

### 2. Environment Configuration
Create `web/.env.local` with the following variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://tajitokri.com
WHATSAPP_ACCESS_TOKEN=your-meta-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_VERIFY_TOKEN=tajitokri_whatsapp_verify_token_2026
```

### 3. Run Locally
```bash
cd web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the customer storefront.

### 4. Build for Production
```bash
cd web
npm run build
npm run start
```

---

## 🧪 Test Verification Suite
Run the test harness located in `web/scripts/`:
```bash
# Verify COD discount & 8 PM cutoff delivery date logic
npx tsx scripts/test-cod-only-mvp.ts

# Verify cart calculation, ₹200 threshold & price tamper-proofing
npx tsx scripts/test-cart-and-pricing-engine.ts

# Verify database connectivity, RLS isolation & production readiness
npx tsx scripts/test-production-readiness.ts
```

---

## 📄 License
Proprietary — All rights reserved for **Taji Tokri (તાજી ટોકરી)**, Halol, Gujarat.
