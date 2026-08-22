# Oracle Cloud Always Free - Zero-Cost Production Deployment Guide

This guide provides the complete, step-by-step instructions to deploy the entire **Sabjiwala Web App + Supabase + n8n + Marketing Broadcast Engine** on a single **Oracle Cloud "Always Free"** instance at **₹0 monthly hosting cost**.

---

## 📋 Architecture & Resource Allocation

| Component | Port / Subdomain | Memory Allocation | Purpose |
| :--- | :--- | :--- | :--- |
| **Coolify (PaaS)** | Port 8000 / Traefik Proxy | ~300 MB | Vercel alternative, Auto-deploy on Git push, Auto SSL |
| **Self-Hosted Supabase** | `https://db.yourdomain.com` | ~1.5 GB | PostgreSQL 17 + Auth + Storage + Studio UI |
| **Self-Hosted n8n** | `https://n8n.yourdomain.com` | ~500 MB | Order webhooks, daily procurement, WhatsApp/SMS broadcast |
| **Next.js Web App** | `https://app.yourdomain.com` | ~350 MB | Customer store + Admin ERP (Standalone container) |
| **Free Buffer** | — | **~9 GB Free RAM** | Handles traffic spikes and broadcast batches safely |

---

## 🛠️ Step 1: Create Oracle Cloud VM (Always Free)

1. Log in to [Oracle Cloud Console](https://cloud.oracle.com/).
2. Navigate to **Compute $\rightarrow$ Instances $\rightarrow$ Create Instance**.
3. Configure the VM with these exact settings:
   - **Name**: `sabjiwala-production-server`
   - **Image**: `Canonical Ubuntu 24.04 Minimal aarch64` (ARM64)
   - **Shape**: `Ampere` $\rightarrow$ `VM.Standard.A1.Flex`
   - **OCPUs**: `2`
   - **RAM**: `12 GB`
   - **Boot Volume**: `150 GB` (Free tier allows up to 200 GB)
   - **SSH Keys**: Download and save your Private Key (`ssh-key.key`).
4. Click **Create** and wait 60 seconds for the instance to become **RUNNING**. Note your **Public IP Address** (e.g. `140.238.xxx.xxx`).

---

## 🔒 Step 2: Configure Oracle Cloud Firewall & Security Lists

### 2.1 Oracle VCN Ingress Rules (In Cloud Console)
Go to **Networking $\rightarrow$ Virtual Cloud Networks $\rightarrow$ Default Security List $\rightarrow$ Ingress Rules $\rightarrow$ Add Ingress Rules**:
- **Source CIDR**: `0.0.0.0/0`
- **Destination Port Range**: `22, 80, 443, 8000`
- **Protocol**: `TCP`

### 2.2 Host Firewall (In Terminal via SSH)
Connect to your server:
```bash
ssh -i "path/to/ssh-key.key" ubuntu@<YOUR_PUBLIC_IP>
```

Run these commands to open ports on the Ubuntu host:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT
sudo netfilter-persistent save
```

---

## 🚀 Step 3: Install Coolify (Private Vercel Engine)

Run the single-line official Coolify installer on your Oracle VM:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Once installation finishes (approx. 2 minutes):
1. Open your browser: `http://<YOUR_PUBLIC_IP>:8000`
2. Register your Root Admin user credentials.

---

## 🌐 Step 4: Configure DNS Records (Cloudflare or Registrar)

Add the following DNS `A` records pointing to your `<YOUR_PUBLIC_IP>`:

| Type | Hostname / Subdomain | Points To | Proxy Status |
| :--- | :--- | :--- | :--- |
| `A` | `sabjiwala.store` (or `@`) | `<YOUR_PUBLIC_IP>` | DNS Only (or Proxied) |
| `A` | `db.sabjiwala.store` | `<YOUR_PUBLIC_IP>` | DNS Only |
| `A` | `n8n.sabjiwala.store` | `<YOUR_PUBLIC_IP>` | DNS Only |

---

## 🗄️ Step 5: Deploy Self-Hosted Supabase in Coolify

1. In Coolify Dashboard, click **+ Add Resource $\rightarrow$ Service $\rightarrow$ Supabase**.
2. Set Domain: `https://db.sabjiwala.store`.
3. Click **Deploy**. Coolify will launch:
   - PostgreSQL 17 Database
   - Supabase Studio Dashboard
   - GoTrue Auth & Kong API Gateway
4. Open `https://db.sabjiwala.store` $\rightarrow$ Log in to **Supabase Studio**.
5. Go to **SQL Editor** and run the project migrations located in `docs/migrations/` in sequence (starting with `20260816000001_sabjiwala_production_schema.sql`).

---

## ⚡ Step 6: Deploy Self-Hosted n8n & Import Workflows

1. In Coolify Dashboard, click **+ Add Resource $\rightarrow$ Service $\rightarrow$ n8n**.
2. Set Domain: `https://n8n.yourdomain.com`.
3. Set Environment Variables:
   - `SABJIWALA_API_BASE_URL`: `https://app.yourdomain.com`
   - `SABJIWALA_INTERNAL_SECRET`: `<YOUR_INTERNAL_SECRET_TOKEN>`
   - `FAST2SMS_API_KEY`: `<YOUR_FAST2SMS_KEY>`
4. Click **Deploy**.
5. Open `https://n8n.yourdomain.com` and create admin credentials.
6. Go to **Workflows $\rightarrow$ Import from File** and import all JSON files from `n8n/workflows/`:
   - `scheme-broadcast-engine.json` *(New marketing engine)*
   - `order-confirmation.json`
   - `out-for-delivery.json`
   - `delivered-bill-summary.json`
   - `procurement-report.json`
   - `operational-alerts.json`
   - `inbound-whatsapp-router.json`
7. Click **Active $\rightarrow$ True** for each workflow.

---

## 💻 Step 7: Deploy Next.js Web Application

1. In Coolify Dashboard, click **+ Add Resource $\rightarrow$ Public/Private Git Repository**.
2. Connect your GitHub repository and select the `web/` base directory.
3. Set Build Pack: **Dockerfile** (Coolify will automatically use `web/Dockerfile`).
4. Set Domain: `https://app.yourdomain.com` (or `https://yourdomain.com`).
5. Configure Environment Variables in Coolify:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://db.yourdomain.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi... (From Supabase Studio Settings)
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (From Supabase Studio Settings - Server Only)
   NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
   INTERNAL_WORKER_SECRET=your_super_secret_token_here
   INTERNAL_API_SECRET=your_super_secret_token_here
   FAST2SMS_API_KEY=your_fast2sms_key
   ```
6. Click **Deploy**.

---

## 📢 Step 8: How to Broadcast Schemes to Customers

To trigger a promotional scheme broadcast (e.g. 50% discount or daily fresh prices):

### Option A: Via Admin Portal / Webhook (Instant Dispatch)
Send a POST request to your n8n webhook:
```bash
curl -X POST https://n8n.yourdomain.com/webhook/sabjiwala-scheme-broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Aaj Ke Fresh Deals",
    "discount_code": "FRESH20",
    "discount_text": "Flat ₹20 OFF on Tomato & Onion",
    "target_segment": "all"
  }'
```

### Option B: Automated Daily Morning Cron
The workflow `scheme-broadcast-engine.json` automatically triggers at **8:00 AM IST** every morning, fetching the daily prices and delivering personalized SMS/WhatsApp messages with anti-spam batch pacing.

---

## 🛡️ Step 9: Automatic Free Backups & Maintenance

1. In Coolify Dashboard, select the **Supabase (PostgreSQL)** service.
2. Go to **Backups $\rightarrow$ Enable Scheduled Backups**.
3. Set Cron: `0 2 * * *` (Daily at 2:00 AM).
4. Set Storage: Local disk or free Cloudflare R2 / S3 bucket.
5. Backups will run completely automated with zero downtime.
