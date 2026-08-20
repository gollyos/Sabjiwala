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

Use [web/.env.example](../web/.env.example) as the authoritative variable list. Generate every secret independently with a cryptographically secure password generator; never reuse the sample text below or commit real values.

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key

# Separate internal secrets
INTERNAL_WORKER_SECRET=generate-a-random-32-byte-secret
INTERNAL_SEED_SECRET=generate-a-different-random-32-byte-secret
PROCUREMENT_LOCK_SECRET=generate-another-random-32-byte-secret

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_or_test_key_id
RAZORPAY_KEY_ID=rzp_live_or_test_key_id
RAZORPAY_KEY_SECRET=your-server-only-key-secret
RAZORPAY_WEBHOOK_SECRET=your-dedicated-webhook-secret

# Meta WhatsApp Cloud API and n8n
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-random-verification-token
N8N_ORDER_WEBHOOK_URL=https://your-n8n-host.example/webhook/order-created

# Public app details
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_STORE_PHONE=+910000000000
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
4. **Migrations:** Apply every SQL file in `docs/migrations` in filename order, including the `20260821` role, payment-attempt, and worker-outbox hardening migrations.
5. **Phone Auth:** Configure an SMS provider, India TRAI/DLT compliance, CAPTCHA, and production rate limits before enabling OTP login.

## 5. Background Workers

Invoke both endpoints on a one-minute schedule using n8n, a trusted cron service, or Vercel Cron. Send `Authorization: Bearer <INTERNAL_WORKER_SECRET>` and never call these endpoints from the browser:

- `POST /api/notifications/process`
- `POST /api/workers/automation`

## 6. Post-Deployment Smoke Test

Immediately verify in production:
1. `GET https://sabjiwala.store/api/health` returns `{"status": "healthy", "release_version": "v1.0.0"}`.
2. Storefront homepage loads fresh vegetables in under 1 second.
3. Cart correctly enforces ₹200 minimum merchandise subtotal before checkout.
4. Admin portal (`/admin/dashboard`) loads with authenticated Owner role.
