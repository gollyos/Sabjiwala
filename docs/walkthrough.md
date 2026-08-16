# Sabjiwala Phone OTP Authentication & Customer Onboarding Walkthrough

## Summary of Implementation

We have implemented customer phone OTP authentication, automatic profile synchronization, and single-entry onboarding for **Sabjiwala (Halol, Panchmahal)**:

### 1. Database & Security Layer (Supabase)
- **RPC `get_current_customer_profile`**: 
  - Resolves active authenticated session (`auth.uid()`).
  - Automatically matches existing phone or customer record.
  - Returns complete customer profile, default delivery address, and full address history.
- **RPC `complete_customer_onboarding`**: 
  - Captures full name, optional alternate mobile, and Halol delivery address (Flat/House No, Society/Street, Landmark, Area).
  - Invokes `verify_customer_phone()` inside a trusted context to transactionally assign `verified_sequence` from `customer_verified_sequence`.
  - Sets the newly registered address as default and returns the complete customer profile.
- **RPC `set_default_customer_address`**: Allows customers with multiple addresses to switch their active delivery destination.
- **Trigger Hardening**: `trigger_protect_customer_security_fields` blocks any unauthorized client tampering of `is_verified` or `verified_sequence` while permitting trusted server RPC execution.

---

### 2. End-to-End Test Customer Verification
We verified both new and returning user paths in PostgreSQL:

| Test Phase | Input / Action | Result | Verification |
| :--- | :--- | :--- | :--- |
| **New Customer Registration** | Phone: `+919876500003`<br>Name: `Priteshbhai Shah`<br>Address: `A-101, Shreenathji Residency, Pavagadh Bypass Road, Halol` | `customers` & `customer_addresses` rows created | `is_verified = true`<br>`verified_sequence = 2`<br>`is_default = true` |
| **Launch Offer Eligibility** | Sequence $\le 500$ evaluation | `FIRST500` 10% Discount unlocked | Calculated on ₹200+ cart |
| **Returning Customer Login** | Calling `get_current_customer_profile()` on verified session | Profile & default address loaded immediately | `is_onboarded = true`<br>Zero re-entry required |

---

### 3. Frontend Architecture (`web/`)
- **Public Browsing (No Login Required)**:
  - Responsive catalog with bilingual names (English & ગુજરાતી), high-res imagery, and category navigation (*Daily Essentials, Leafy Greens, Gourds, Root & Tubers, Fresh Herbs*).
  - Multi-variant packaging (250g, 500g, 1kg, bunches) with instant price recalculation.
- **Phone OTP Authentication (`AuthModal.tsx`)**:
  - Step 1: Mobile number entry (+91 formatted, 10 digits).
  - Step 2: 6-digit OTP entry with auto-focus, paste support, and 30s resend countdown.
  - Step 3 (First-Time Only): Streamlined onboarding form with pre-filled Halol location tokens (`Halol`, `Panchmahal`, `389350`).
  - Returning users are greeted instantly by name and returned directly to their basket.
- **Cart & Checkout Drawer (`CartDrawer.tsx`)**:
  - Live ₹200 minimum order progress indicator.
  - Daily 8:00 PM IST cutoff banner (next morning 10 AM–1 PM delivery).
  - Auto-applied **2% Cash On Delivery discount** + **10% FIRST500 launch discount**.
  - Server-side atomic order placement via `create_customer_order` RPC.
- **Customer Profile & Address Management (`CustomerProfileModal.tsx`)**:
  - Displays customer verified badge and Halol sequence number.
  - Lists saved delivery addresses with 1-click "Set as Default" toggle.

---

### 4. Build & Server Status
- **Next.js Production Build**: `Compiled successfully in 4.5s` with 0 TypeScript/lint errors.
- **Development Server**: Active and responding with `HTTP 200 OK` on `http://localhost:3000`.
