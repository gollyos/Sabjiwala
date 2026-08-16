# Sabjiwala Production Deployment Guide

## 1. Hosting & Infrastructure Architecture

- **Web Frontend & API Routes:** Next.js 16 (React 19) hosted on **Vercel**.
- **Authoritative Database & Auth:** PostgreSQL hosted on **Supabase** (`Asia/Kolkata` region).
- **Automation & Orchestration:** **n8n** (Self-hosted or Cloud) for WhatsApp Meta triggers and scheduled jobs.
- **Messaging Service:** **Meta WhatsApp Cloud API** (`v20.0`).
- **Primary Production Domain:** `https://sabjiwala.store`

---

## 2. Environment Variables Configuration

Set these environment variables in your Vercel Project Settings (`Settings` $\rightarrow$ `Environment Variables`) and server environments:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://jaotajpowcgzxgpcezvi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Internal API Secret for n8n Webhooks & Background Workers
INTERNAL_API_SECRET=sabjiwala_prod_internal_secret_2026

# Meta WhatsApp Cloud API (Optional if managed via n8n)
WHATSAPP_PHONE_NUMBER_ID=sabjiwala_phone_id_halol
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_VERIFY_TOKEN=sabjiwala_meta_webhook_verify_token_2026

# Public App URL
NEXT_PUBLIC_APP_URL=https://sabjiwala.store
```

---

## 3. Vercel Deployment Checklist

1. **Connect GitHub Repository:** Link `main` branch to Vercel.
2. **Build Settings:**
   - Framework Preset: Next.js
   - Root Directory: `web`
   - Build Command: `npm run build`
   - Output Directory: `.next`
3. **Domain Configuration:**
   - Add Apex Domain: `sabjiwala.store` (A Record $\rightarrow$ `76.76.21.21`)
   - Add Subdomain: `www.sabjiwala.store` (CNAME $\rightarrow$ `cname.vercel-dns.com`)
   - Ensure SSL certificate issuance status is **Active (HTTPS)**.

---

## 4. Supabase Production Hardening

1. **Authentication Settings:**
   - Site URL: `https://sabjiwala.store`
   - Additional Redirect URLs:
     - `https://sabjiwala.store/**`
     - `https://www.sabjiwala.store/**`
2. **Database Extensions:**
   - Verify `pgcrypto` and `uuid-ossp` are enabled.
3. **Storage Bucket Policies:**
   - `product-images`: Public read, authenticated admin write.
   - `delivery-proofs`: Strictly private read/write, accessible only by authenticated staff and driver.

---

## 5. Post-Deployment Smoke Test

Immediately verify in production:
1. `GET https://sabjiwala.store/api/health` returns `{"status": "healthy", "release_version": "v1.0.0"}`.
2. Storefront homepage loads fresh vegetables in under 1 second.
3. Cart correctly enforces ₹200 minimum merchandise subtotal before checkout.
4. Admin portal (`/admin/dashboard`) loads with authenticated Owner role.
