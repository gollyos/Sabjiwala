# Oracle Cloud Always Free - Zero-Cost Production Deployment Guide

This guide provides the complete, step-by-step instructions to deploy the entire **Taji Tokri Web App + Supabase + n8n + Marketing Broadcast Engine** on a single **Oracle Cloud "Always Free"** instance at **₹0 monthly hosting cost**.

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
   - **Name**: `tajitokri-production-server`
   - **Image**: `Canonical Ubuntu 24.04 Minimal aarch64` (ARM64)
   - **Shape**: `Ampere` $\rightarrow$ `VM.Standard.A1.Flex`
   - **OCPUs**: `2`
   - **RAM**: `12 GB`
   - **Boot Volume**: `150 GB` (Free tier allows up to 200 GB)
   - **SSH Keys**: Download and save your Private Key (`ssh-key.key`).
4. Click **Create** and wait 60 seconds for the instance to become **RUNNING**. Note your **Public IP Address** (e.g. `140.238.xxx.xxx`).

---

## 🔒 Step 2: Configure Oracle Cloud Firewall & Security Lists

> ⚠️ **Security: never expose Coolify's admin port (8000) to `0.0.0.0/0`.** Coolify has no admin account until you complete first-run registration in Step 3 — anyone who can reach port 8000 before you do can register themselves as the root admin and take over the entire deployment (all connected servers, databases, and secrets). This is an unauthenticated race condition, not a hypothetical: on a public IP, automated scanners typically find open port 8000 within minutes of it going live. Port 8000 does **not** need to be public at all — Coolify's UI is only for the operator, never for end users — so keep it IP-restricted or tunnel-only permanently, not just "until setup is done."

### 2.1 Oracle VCN Ingress Rules (In Cloud Console)
Go to **Networking $\rightarrow$ Virtual Cloud Networks $\rightarrow$ Default Security List $\rightarrow$ Ingress Rules $\rightarrow$ Add Ingress Rules**.

Open the public-facing web ports to everyone, but restrict the Coolify admin port to yourself:
- **Rule 1 — Web traffic**
  - **Source CIDR**: `0.0.0.0/0`
  - **Destination Port Range**: `22, 80, 443`
  - **Protocol**: `TCP`
  - (Consider further restricting port `22` (SSH) to your own IP as well.)
- **Rule 2 — Coolify admin UI (port 8000)**
  - **Source CIDR**: `<YOUR_PUBLIC_IP>/32` (find it via `curl ifconfig.me` on your own machine — **not** the server)
  - **Destination Port Range**: `8000`
  - **Protocol**: `TCP`
  - **Recommended alternative (safer, no open port at all):** skip this rule entirely and access Coolify only via an SSH tunnel: `ssh -L 8000:localhost:8000 ubuntu@<YOUR_PUBLIC_IP>`, then browse to `http://localhost:8000` on your own machine.

### 2.2 Host Firewall (In Terminal via SSH)
Connect to your server:
```bash
ssh -i "path/to/ssh-key.key" ubuntu@<YOUR_PUBLIC_IP>
```

Open the public web ports, and restrict 8000 to your own IP (skip the 8000 rule entirely if you're using the SSH tunnel approach above):
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp -s <YOUR_PUBLIC_IP>/32 --dport 8000 -j ACCEPT
sudo netfilter-persistent save
```

---

## 🚀 Step 3: Install Coolify (Private Vercel Engine)

Run the single-line official Coolify installer on your Oracle VM:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Once installation finishes (approx. 2 minutes):

> ⚠️ **Security: register the root admin account immediately, before anyone else can reach port 8000.** Do this over the restricted access path from Step 2 (your IP-restricted rule, or the SSH tunnel) — never leave this step for later or perform it over a connection open to `0.0.0.0/0`.

1. Open your browser to the Coolify UI using whichever restricted access method you set up in Step 2:
   - IP-restricted rule: `http://<YOUR_PUBLIC_IP>:8000`
   - SSH tunnel (recommended): run `ssh -L 8000:localhost:8000 ubuntu@<YOUR_PUBLIC_IP>` in a terminal, then browse to `http://localhost:8000`
2. Register your Root Admin user credentials **immediately** — this is a one-time, first-come first-served registration with no invite or approval step.
3. Keep port 8000 IP-restricted (or tunnel-only) permanently. It never needs to be opened to `0.0.0.0/0` — all day-to-day access (Git push deploys, app traffic) flows through ports 80/443/Traefik, not through the Coolify admin UI.

---

## 🌐 Step 4: Configure DNS Records (Cloudflare or Registrar)

Add the following DNS `A` records pointing to your `<YOUR_PUBLIC_IP>`:

| Type | Hostname / Subdomain | Points To | Proxy Status |
| :--- | :--- | :--- | :--- |
| `A` | `tajitokri.store` (or `@`) | `<YOUR_PUBLIC_IP>` | DNS Only (or Proxied) |
| `A` | `db.tajitokri.store` | `<YOUR_PUBLIC_IP>` | DNS Only |
| `A` | `n8n.tajitokri.store` | `<YOUR_PUBLIC_IP>` | DNS Only |

---

## 🗄️ Step 5: Deploy Self-Hosted Supabase in Coolify

1. In Coolify Dashboard, click **+ Add Resource $\rightarrow$ Service $\rightarrow$ Supabase**.
2. Set Domain: `https://db.tajitokri.store`.
3. Click **Deploy**. Coolify will launch:
   - PostgreSQL 17 Database
   - Supabase Studio Dashboard
   - GoTrue Auth & Kong API Gateway
4. Open `https://db.tajitokri.store` $\rightarrow$ Log in to **Supabase Studio**.
5. Go to **SQL Editor** and run the project migrations located in `docs/migrations/` in sequence (starting with `20260816000001_tajitokri_production_schema.sql`).

---

## ⚡ Step 6: Deploy Self-Hosted n8n & Import Workflows

1. In Coolify Dashboard, click **+ Add Resource $\rightarrow$ Service $\rightarrow$ n8n**.
2. Set Domain: `https://n8n.yourdomain.com`.
3. Set Environment Variables:
   - `TAJI TOKRI_API_BASE_URL`: `https://app.yourdomain.com`
   - `TAJI TOKRI_INTERNAL_SECRET`: `<YOUR_INTERNAL_SECRET_TOKEN>`
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
curl -X POST https://n8n.yourdomain.com/webhook/tajitokri-scheme-broadcast \
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
4. Set Storage: **Cloudflare R2 or an S3-compatible bucket — off-box storage only.** Do not select "Local disk": this VM is the only copy of production data, so a local-disk backup lives on the same box it's meant to protect against. A single VM failure, disk corruption, or compromise would destroy the database and its backup together, leaving nothing to restore from. R2's free tier (10 GB storage) is more than sufficient for daily Postgres dumps at this scale.
5. Backups will run completely automated with zero downtime.
