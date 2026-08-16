# Sabjiwala Disaster Recovery & Backup Procedures

## 1. Overview & Resilience Architecture

Sabjiwala operates as a fresh vegetable delivery platform serving the Halol, Panchmahal region. PostgreSQL (hosted on Supabase) is the single source of truth for catalog pricing, orders, procurement batches, packing bags, delivery logs, cash reconciliation, and audit logs.

```mermaid
flowchart TD
    A[Production Incident Triggered] --> B{Incident Category}
    B -->|Database Corruption / Data Loss| C[Database Recovery SOP]
    B -->|Frontend / App Crash| D[Vercel Rollback SOP]
    B -->|n8n / WhatsApp Outage| E[Notification Fallback SOP]
    B -->|Godown Printer Offline| F[Thermal Print Fallback SOP]
    B -->|Driver Phone / Cash Issue| G[Driver Cash Reconcile SOP]
    B -->|Staff Account Compromised| H[Staff Security Revocation SOP]
```

---

## 2. Supabase / PostgreSQL Backup Strategy

### A. Point-in-Time Recovery & Scheduled Snapshots
1. **Automated Daily Backups:** Managed daily via Supabase Managed Postgres.
2. **Backup Retention:** 7 to 30 days depending on the active production organization tier.
3. **Manual CSV Data Exports:**
   Owner or authorized Admin can export authoritative business tables anytime from the Admin Reporting Suite (`/admin/reports/...`) or via PostgreSQL pg_dump:
   - `customers` & `customer_addresses`
   - `orders` & `order_items`
   - `procurement_batches` & `supplier_purchases`
   - `deliveries` & `driver_cash_settlements`
   - `app_settings` & `audit_logs`

### B. Command-Line pg_dump Export (Secure Production Backup)
Run from a secure terminal with the production database connection string:
```bash
pg_dump "postgresql://postgres:[DB_PASSWORD]@db.jaotajpowcgzxgpcezvi.supabase.co:5432/postgres" \
  --schema=public \
  --format=custom \
  --file="sabjiwala_backup_$(date +%Y%m%d_%H%M%S).dump"
```

---

## 3. Incident Scenarios & Step-by-Step Runbooks

### Scenario A: Accidental Database Deletion or Corruption
1. **Assess Impact:** Identify whether corruption affected specific tables (`orders`, `deliveries`) or the full database.
2. **Stop Ingest:** Put the storefront into maintenance mode by toggling `pilot_mode_enabled` or temporary maintenance banner.
3. **Restore from Snapshot:**
   - Go to Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ Backups.
   - Select the nearest point-in-time backup before the incident.
   - Restore to a new branch or restore directly to production.
4. **Reconcile Offline Deliveries:** Compare physical driver run sheets against restored order records.

---

### Scenario B: Broken Frontend Deployment on Vercel
1. **Immediate Rollback:**
   - Open Vercel Project Dashboard $\rightarrow$ Deployments.
   - Locate the previous successful production build.
   - Click the three dots `...` and select **"Promote to Production"** (instant zero-downtime rollback).
2. **Audit Root Cause:** Inspect local git diff and fix in a feature branch before redeploying to `main`.

---

### Scenario C: WhatsApp Business API / n8n Failure
1. **Decoupled Architecture:** Core order creation, 8 PM batch locking, and delivery completions **never block or fail** when WhatsApp or n8n is offline.
2. **Notification Queue Backlog:**
   - Notification jobs are persisted with status `queued` in the `notification_jobs` table.
   - Once WhatsApp / n8n connectivity is restored, trigger the batch retry worker via `POST /api/notifications/process` or click **"Retry Failed"** in `/admin/notifications`.
3. **Customer Inquiries:** Inbound phone calls or SMS can be handled directly by customer support via `+919876543210`.

---

### Scenario D: Godown Thermal Printer Offline
1. **Direct Browser Print:** If the USB thermal printer agent disconnects, packing staff can switch to normal browser print dialog (`window.print()`) in `/admin/packing`.
2. **Manual Marker Backup:** Write Order Number (e.g. `SBJ-20260817-0042`) and Bag sequence (`Bag 1 of 2`) directly on the physical bag with permanent marker.
3. **Driver QR Fallback:** Driver can enter the Order Number manually on `/driver` if barcode scanning fails.

---

### Scenario E: Staff Account Compromise or Unauthorized Access
1. **Immediate Revocation:** Owner navigates to `/admin/staff`.
2. **Deactivate User:** Click **"Edit"** on the compromised staff member and toggle **"Active Status"** to **Inactive**.
3. **Enforcement:** Inactive accounts are immediately rejected by database RLS and server-side RPC functions (`is_active = true` guard).
4. **Audit Inspection:** Review `/admin/reports/sales` and `audit_logs` table for any unauthorized modifications.
