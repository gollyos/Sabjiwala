# 🌿 Taji Tokri - Direct WhatsApp Automation Setup Guide (Supabase + n8n)

Is setup me **Google Sheets ki koi zaroorat nahi hai**. 
- **Main Database:** 100% **Supabase PostgreSQL** (Superfast, Bank-Grade Safe, Scalable).
- **Business Operations:** 100% **Taji Tokri Admin Panel** (Live Orders, Mandi Procurement, Packing, Driver Cash Settlement, Search, Date/Week/Month Analytics).
- **n8n Automation:** Purely dedicated to **Automated WhatsApp Messages** (Customer Receipt + Admin Alert).

---

## ⚡ What Happens When a Customer Places an Order:
```
Customer Places Order on Website / PWA
                │
                ▼
      Saved in Supabase Database (100% Safe)
                │
                ├─────────────────────────────────────────────────┐
                ▼                                                 ▼
      Taji Tokri Admin Panel                             n8n Webhook Trigger
 (Live Screen Auto-Update in Realtime)                            │
                                                ┌─────────────────┴─────────────────┐
                                                ▼                                   ▼
                                      Customer WhatsApp Message             Admin WhatsApp Alert
                                  (Order Confirmation & Bill)         (🔔 New Order #SBJ-...)
```

---

## 📥 3-Step Setup for n8n WhatsApp Automation:

### Step 1: Import Workflow in n8n
1. Open your n8n dashboard (e.g. `https://n8n.yourdomain.com`).
2. Click **`...` (Menu)** on the top right $\to$ **Import from File / JSON**.
3. Select the file:
   [`c:/Taji Tokri Project/docs/n8n/tajitokri_n8n_order_automation_workflow.json`](file:///c:/Taji Tokri%20Project/docs/n8n/tajitokri_n8n_order_automation_workflow.json)

---

### Step 2: Configure WhatsApp API & Admin Phone
1. Double-click on **"Send WhatsApp To Customer"**:
   - Replace `YOUR_META_OR_WHATSAPP_API_KEY` with your WhatsApp API Token.
2. Double-click on **"Notify Store Admin (WhatsApp)"**:
   - Change `919876543210` to the **Store Owner's Mobile Number**.
3. Click the **Active** toggle switch (Turn it **ON**).
4. Copy the **Webhook Production URL**:
   Example: `https://n8n.yourdomain.com/webhook/tajitokri-new-order`

---

### Step 3: Connect in Taji Tokri Admin Panel
1. Open [`https://tajitokri.store/admin/settings`](https://tajitokri.store/admin/settings).
2. Go to **"n8n Automation (ઓટોમેશન)"** tab.
3. Paste the URL into **n8n Webhook Production URL**.
4. Click **"Test Webhook (ટેસ્ટ કરો)"** $\to$ Confirm green checkmark $\to$ Click **Save**.

---

## 🛡️ Admin Panel 100% Access & Capabilities:
Aapko kisi external tool ya spreadsheet ki zaroorat nahi:
- **Live Orders:** [`/admin/orders`](file:///c:/Taji Tokri%20Project/web/src/app/admin/orders/page.tsx) (Live auto-refresh, search by mobile/name/order #, Date/Week/Month filters, 1-click Excel download).
- **Mandi Buying:** [`/admin/procurement`](file:///c:/Taji Tokri%20Project/web/src/app/admin/procurement/page.tsx) (Subah APMC mandi me kya khareedna hai, 1-click WhatsApp copy).
- **Packing Station:** [`/admin/packing`](file:///c:/Taji Tokri%20Project/web/src/app/admin/packing/page.tsx) (1-Click quick pack & standard printer slip).
- **Driver Cash Settlement:** [`/admin/delivery`](file:///c:/Taji Tokri%20Project/web/src/app/admin/delivery/page.tsx) (COD cash collection verification).
- **Profit & Sales Analytics:** [`/admin/reports`](file:///c:/Taji Tokri%20Project/web/src/app/admin/reports/page.tsx).
