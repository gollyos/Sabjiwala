# Sabjiwala Roles & Permissions Matrix

This document defines the authoritative access levels and security boundaries across all user roles in Sabjiwala.

---

## 1. Role Matrix Overview

| Module / Resource | Owner (માલિક) | Manager (મેનેજર) | Packing Staff (પેકિંગ) | Delivery Staff (ડિલિવરી) | Customer (ગ્રાહક) | Anonymous (અજાણ્યો મુલાકાતી) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Public Product Catalog** | Read / Write | Read / Write | Read | Read | Read | Read Only (Public) |
| **Selling Price Management** | Full Access | Full Access | No Access | No Access | No Access | No Access |
| **Supplier Purchasing & Costs** | Full Access | Full Access | No Access | No Access | No Access | No Access |
| **Order Creation** | Full Access | Full Access | No Access | No Access | Own Orders Only | No Access |
| **Order History & Invoices** | All Orders | All Orders | Packed Orders | Assigned Orders | Own Orders Only | Token-only (`/track/[token]`) |
| **Customer PII & Addresses** | Full Access | Operational | Minimal Masked | Assigned Address | Own Profile Only | No Access |
| **Procurement Batches** | Full Access | Full Access | Read Requirements | No Access | No Access | No Access |
| **Warehouse Packing & Stickers**| Full Access | Full Access | Pack & Verify | No Access | No Access | No Access |
| **Delivery Driver Run & COD** | Full Access | Full Access | No Access | Assigned Run Only | No Access | No Access |
| **Driver Cash Settlement** | Verify / Settle| Verify / Settle| No Access | Submit Handover | No Access | No Access |
| **Owner Financial Dashboard** | Full Access | Selected Reports| No Access | No Access | No Access | No Access |
| **Staff & Role Management** | Full Access | No Access | No Access | No Access | No Access | No Access |
| **Business Settings & Flags** | Full Access | Operational Only| No Access | No Access | No Access | No Access |
| **Audit Logs** | Read Only | No Access | No Access | No Access | No Access | No Access |

---

## 2. Principle of Least Privilege Enforcement

1. **Owner Role Protection:**
   - Only `owner` can add, remove, or change staff roles via `manage_staff_user` RPC.
   - The primary Owner cannot demote or deactivate themselves.
2. **Godown Staff Isolation:**
   - Packing staff only see product names, quantities, and masked customer mobile numbers. They cannot see supplier purchase rates, profit margins, or financial ledger balances.
3. **Driver Isolation:**
   - Delivery staff can only access orders on their assigned delivery batch. They cannot access other drivers' deliveries, historical sales reports, or system settings.
4. **Customer Data Isolation:**
   - Row Level Security (RLS) ensures customers can query only their own profile, addresses, and order history (`WHERE customer_id = auth.uid()`).
5. **Anonymous Catalog Protection:**
   - Anonymous visitors can view `public_catalog_variants` with selling prices, units, and images. Sensitive supplier cost columns (`supplier_cost`, `cost_price_snapshot`) are excluded.
