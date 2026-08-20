# TaazaTokra Web Application

Production web frontend and API engine for **TaazaTokra (તાજાટોકરા)** — Fresh Fruits & Vegetables Delivery in Halol, Gujarat.

## Technology Stack
- **Framework**: Next.js 16 (App Router with TypeScript)
- **Styling**: Tailwind CSS v4
- **Database & Auth**: Supabase (@supabase/ssr & PostgreSQL with Row Level Security)
- **Automation**: n8n Webhook Engine & Meta WhatsApp Cloud API
- **Icons**: Lucide React & Custom Brand Vectors

## Scripts
- `npm run dev`: Start local Next.js development server.
- `npm run build`: Compile optimized production bundle.
- `npm run start`: Launch production web server.
- `npx tsc --noEmit`: Run TypeScript static type verification.

## Key Directories
- `src/app`: App Router pages (Storefront, Admin HQ, Driver Portal, SEO landing pages, Web APIs).
- `src/components`: UI components (Navbar, BrandLogo, CartDrawer, AuthModal, PackingStickers).
- `src/context`: AuthContext and CartContext state providers.
- `src/lib`: Database client, n8n webhook dispatcher, barcode generators, and WhatsApp services.
- `scripts`: Automated test harness verifying business rules, calculations, and security policies.
