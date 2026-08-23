# Taji Tokri (તાજી ટોકરી) — Pilot Deployment & External Brand Launch Checklist

This document details all external, operational, and configuration tasks required for the pilot deployment of **Taji Tokri** in Halol, Panchmahal, Gujarat.

---

## 1. Domain & DNS Configuration
- [ ] **Primary Domain Registration**:
  - Purchase `tajitokri.com` and/or `tajitokri.in`.
- [ ] **Vercel / Hosting DNS Setup**:
  - `A` Record: `76.76.21.21` pointing to Vercel.
  - `CNAME` Record: `cname.vercel-dns.com` for `www.tajitokri.com`.
  - Configure SSL and canonical redirection from `www` to root (or vice versa).
- [ ] **Environment Variables**:
  - Set `NEXT_PUBLIC_SITE_URL=https://tajitokri.com` in production Vercel project settings.

---

## 2. Google Search Console & Local SEO (Halol)
- [ ] **Google Search Console**:
  - Add property `https://tajitokri.com`.
  - Submit sitemap: `https://tajitokri.com/sitemap.xml`.
  - Verify robots.txt: `https://tajitokri.com/robots.txt`.
- [ ] **Google Business Profile (Halol Location)**:
  - Create Profile Name: `Taji Tokri - Fresh Fruits & Vegetables Delivery (તાજી ટોકરી)`
  - Primary Category: `Fruit and Vegetable Store` / `Grocery Delivery Service`
  - Address: `Halol, Panchmahal, Gujarat - 389350`
  - Service Area: `Halol, Baska GIDC, Pavagadh Bypass, Panchmahal`
  - Operating Hours: `6:00 AM – 8:00 PM`
  - Website Link: `https://tajitokri.com`

---

## 3. WhatsApp Business Platform & Meta Cloud API
- [ ] **WhatsApp Business Display Name**:
  - Submit Display Name: `Taji Tokri`
  - Category: `Grocery & Food Delivery`
  - Description: `Taaza Phal, Taazi Sabzi — Seedha Ghar Tak. Fresh daily morning fruits and vegetables delivery in Halol.`
- [ ] **Meta Cloud API Webhook**:
  - Set Webhook callback URL: `https://tajitokri.com/api/webhooks/whatsapp`
  - Verify Token: Matches `WHATSAPP_VERIFY_TOKEN` in `.env.local` / Vercel.

---

## 4. n8n Automation Engine Setup
- [ ] **n8n Instance Setup**:
  - Host self-hosted n8n (Railway, Render, DigitalOcean, or n8n Cloud).
  - Import workflow: [`docs/n8n/tajitokri_n8n_order_automation_workflow.json`](file:///c:/Taji Tokri%20Project/docs/n8n/tajitokri_n8n_order_automation_workflow.json).
- [ ] **Webhook Connection**:
  - Open Taji Tokri Admin Settings $\to$ **n8n Automation** tab.
  - Paste n8n Webhook Production URL.
  - Click **"⚡ Test n8n Webhook Connection"** to verify 200 OK receipt.

---

## 5. Daily Operations & Halol Sourcing Timetable
- **20:00 (8:00 PM IST)**:
  - Order cutoff for next-morning delivery.
  - Sourcing batch auto-freezes in Admin Procurement.
- **20:30 (8:30 PM IST)**:
  - Godown manager clicks **"Copy Mandi Sheet (WhatsApp)"** to dispatch purchasing requirement to APMC buyer.
- **04:30 – 06:30 AM IST**:
  - Fresh produce arrives at Godown; manager logs actual APMC buying prices.
- **06:30 – 09:30 AM IST**:
  - Packing team cleans, weighs, and bags orders in reusable zero-plastic cotton bags.
- **10:00 AM – 01:00 PM IST**:
  - Drivers deliver orders to Halol doorsteps with Cash on Delivery (COD) collection.

---

## 6. Trademark & Legal
- [ ] File Class 31 (Fresh fruits and vegetables) and Class 39 (Transport and delivery of goods) trademark application for `Taji Tokri` (તાજી ટોકરી).
- [ ] Procure FSSAI Basic Registration / State License for retail and delivery of fresh agricultural produce in Gujarat.
