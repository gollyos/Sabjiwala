# Taji Tokri Comprehensive Testing & Verification Matrix

This document outlines the testing strategy, boundary test cases, and completion test matrix for Taji Tokri.

---

## 1. Completion Test Matrix

| Module | Scope Tested | Result | Notes / Conditions |
| :--- | :--- | :---: | :--- |
| **Customer Auth & OTP** | 10-digit Indian mobile, OTP verification, session storage | **PASS** | SMS gateway simulated in dev; E.164 normalized |
| **Public Catalog** | Bilingual categories, vegetable variants, stock flags | **PASS** | Supplier cost & margin strictly hidden |
| **Cart & Pricing Engine** | ₹200 threshold, FIRST500 (10%), COD discount (2%) | **PASS** | Enforced before discounts; server-authoritative |
| **Atomic Order Creation** | Frozen snapshots, idempotency key, unique tracking token | **PASS** | Immutable snapshots for name, address, price |
| **8 PM Cutoff Logic** | 19:59 IST (next-day) vs 20:00 IST (next-to-next-day) | **PASS** | Tested in PostgreSQL with `Asia/Kolkata` |
| **Procurement Batches** | Authoritative aggregation, units (kg, bunch, piece) | **PASS** | Locked batch immutable to later late orders |
| **Supplier Purchasing** | Multi-supplier purchase rates, receiving weight, wastage | **PASS** | Wastage & contribution tracked accurately |
| **Warehouse Packing** | Item checklists, multi-bag creation, thermal sticker print | **PASS** | Privacy-safe stickers without supplier rates |
| **Delivery Driver Screen** | Mobile route view, QR/barcode bag scan, COD collection | **PASS** | Prevents wrong customer bag delivery |
| **Cash Settlement** | Handover vs collected cash, discrepancy alerts | **PASS** | Discrepancy logged and alerted to Owner |
| **Owner Dashboard** | Real-time KPIs, sales charts, reconciliation views | **PASS** | Authoritative calculations from PostgreSQL |
| **WhatsApp Automation** | Outbox queue, retry backoff, bilingual templates | **PASS** | Tested with Meta transport simulator & triggers |
| **Staff & Settings** | Owner delegation, deactivation, setting RPC guards | **PASS** | Manager cannot promote to Owner |
| **Disaster Recovery** | Database snapshot export, Vercel rollback SOPs | **PASS** | Documented and verified |

---

## 2. Boundary Condition Test Cases

### Test Case A: ₹200 Minimum Cart Validation
- **Input:** Merchandise Subtotal = ₹199.90.
- **Expected:** Order creation rejected with `"Minimum order merchandise subtotal is ₹200"`.
- **Input:** Merchandise Subtotal = ₹200.00.
- **Expected:** Order creation allowed. FIRST500 (10% = ₹20) + COD 2% (₹3.60) applied $\rightarrow$ Final Payable = ₹176.40.
- **Verification:** Threshold is evaluated against **merchandise subtotal before discounts**.

### Test Case B: 8 PM Cutoff Boundary
- **Input:** Order confirmed at `19:59:59` IST on 16 Aug 2026.
- **Expected Delivery Date:** `17 Aug 2026` (Next Day, 10:00 AM - 1:00 PM).
- **Input:** Order confirmed at `20:00:00` IST on 16 Aug 2026.
- **Expected Delivery Date:** `18 Aug 2026` (Next-to-Next Day, 10:00 AM - 1:00 PM).

### Test Case C: Multi-Bag Packing Mismatch Prevention
- **Scenario:** Order requires 2 bags (`SBJ-20260817-0042-B1` and `SBJ-20260817-0042-B2`).
- **Driver Action:** Driver attempts to deliver with only `Bag 1` scanned.
- **Expected:** System blocks completion with `"All bags (2 of 2) must be scanned before delivery"`.
