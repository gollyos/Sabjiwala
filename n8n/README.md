# Sabjiwala n8n Automation Workflows & Setup Guide

This directory contains version-controlled workflow definitions for orchestrating **WhatsApp Business notifications**, **8 PM Mandi Procurement batch locking**, and **Owner Operational alerts** for Sabjiwala.

---

## 1. Overview of Included Workflows

| File | Workflow Name | Trigger | Description |
| :--- | :--- | :--- | :--- |
| `workflows/order-confirmation.json` | **Workflow 1: Customer Order Confirmation** | Webhook / Event | Dispatches bilingual order confirmation message + secure order tracking link. |
| `workflows/procurement-report.json` | **Workflow 2: 8 PM Owner Procurement Report** | 8:00:05 PM IST Cron / Webhook | Locks 8 PM batch & sends morning mandi requirement to Owner WhatsApp. |
| `workflows/out-for-delivery.json` | **Workflow 3: Out for Delivery Alert** | Delivery Batch Start Webhook | Alerts customer that driver is en-route for 10 AM–1 PM delivery. |
| `workflows/delivered-bill-summary.json` | **Workflow 4: Delivery Confirmation & Bill** | Delivery Completed Webhook | Sends delivery receipt, COD amount collected, and repeat order shortcut. |
| `workflows/operational-alerts.json` | **Workflow 5: Operational Exception Alerts** | Exception Webhook | Alerts owner for godown packing problems, delivery failures, and cash discrepancies. |
| `workflows/inbound-whatsapp-router.json` | **Workflow 6: Inbound WhatsApp Router** | Meta Cloud Webhook | Handles customer keywords (`HELP`, `ORDER`, `MY ORDER`, `REPEAT`, `ADDRESS`). |

---

## 2. Environment Variables & n8n Secrets

Configure the following environment variables in your self-hosted or cloud n8n instance:

```env
# Sabjiwala Webhook & API Gateway Base URL
SABJIWALA_API_BASE_URL=https://sabjiwala.store

# Internal Worker / Webhook Secret Token
SABJIWALA_INTERNAL_SECRET=sabjiwala_worker_secret_2026

# Procurement 8 PM Batch Lock Token
SABJIWALA_PROCUREMENT_SECRET=sabjiwala_procurement_lock_token_halol_2026

# Meta WhatsApp Cloud API Credentials
WHATSAPP_PHONE_NUMBER_ID=sabjiwala_phone_id_halol
WHATSAPP_ACCESS_TOKEN=EAABxxxxxxxxxxxxxxxxxxxx
WHATSAPP_VERIFY_TOKEN=sabjiwala_whatsapp_verify_token_2026
```

---

## 3. How to Import Workflows into n8n

1. Open your n8n Dashboard.
2. Click **Add Workflow** $\rightarrow$ **Import from File...**
3. Select the respective `.json` file from `n8n/workflows/`.
4. Verify HTTP Request credential parameters match your `SABJIWALA_INTERNAL_SECRET`.
5. Toggle the workflow to **Active**.
