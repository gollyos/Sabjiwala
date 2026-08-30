import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Manrope, Noto_Sans_Gujarati, Baloo_2, Baloo_Bhai_2 } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { CustomerProfileModal } from '@/components/CustomerProfileModal';
import { CartDrawer } from '@/components/CartDrawer';
import { OrderSuccessModal } from '@/components/OrderSuccessModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tajitokri.com';
const storePhone = '+917069131300';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const notoGujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  variable: '--font-gujarati',
  display: 'swap',
});

const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

// Gujarati sibling of Baloo 2 — same rounded, high-energy character in Gujarati script
const balooGujarati = Baloo_Bhai_2({
  subsets: ['gujarati'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display-gu',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#059669',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Taji Tokri | Fresh Fruits & Vegetables Delivery in Halol (તાજી ટોકરી)',
    template: '%s | Taji Tokri Halol',
  },
  description: 'Order fresh fruits and vegetables online in Halol from Taji Tokri (તાજી ટોકરી). Taaza Phal, Taazi Sabzi — Seedha Ghar Tak. Convenient doorstep delivery with COD.',
  keywords: [
    'Taji Tokri',
    'Taji Tokri Halol',
    'તાજી ટોકરી',
    'fresh fruits Halol',
    'fresh vegetables Halol',
    'fruit delivery Halol',
    'vegetable delivery Halol',
    'fruits and vegetables delivery Halol',
    'online fruits Halol',
    'online vegetables Halol',
    'તાજા ફળ અને શાકભાજી હાલોલ',
    'તાજા શાકભાજી ડિલિવરી હાલોલ',
    'Panchmahal fruits and vegetables',
  ],
  authors: [{ name: 'Taji Tokri Fresh Produce Team' }],
  creator: 'Taji Tokri',
  publisher: 'Taji Tokri Halol',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512x512.png', type: 'image/png', sizes: '512x512' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Taji Tokri',
  },
  formatDetection: {
    telephone: true,
    address: true,
  },
  openGraph: {
    type: 'website',
    locale: 'gu_IN',
    url: siteUrl,
    title: 'Taji Tokri • તાજી ટોકરી | Fresh Fruits & Vegetables Delivery in Halol',
    description: 'Taaza Phal, Taazi Sabzi — Seedha Ghar Tak. Order fresh fruits & vegetables daily in Halol with Cash on Delivery.',
    siteName: 'Taji Tokri',
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'Taji Tokri Fresh Fruits and Vegetables Delivery in Halol',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taji Tokri • તાજી ટોકરી | Fresh Fruits & Vegetables in Halol',
    description: 'Taaza Phal, Taazi Sabzi — Seedha Ghar Tak. Fresh fruits & vegetables delivered daily in Halol.',
    images: [`${siteUrl}/opengraph-image`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLdSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'GroceryStore',
      '@id': `${siteUrl}/#store`,
      name: 'Taji Tokri (તાજી ટોકરી)',
      alternateName: 'Taji Tokri Halol',
      description: 'Fresh fruits and vegetables delivery in Halol, Panchmahal, Gujarat. Taaza Phal, Taazi Sabzi — Seedha Ghar Tak.',
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      image: `${siteUrl}/opengraph-image`,
      ...(storePhone ? { telephone: storePhone } : {}),
      priceRange: '₹10–₹500',
      paymentAccepted: 'Cash on Delivery (COD), UPI, Cards, Netbanking',
      currenciesAccepted: 'INR',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Halol',
        addressRegion: 'Gujarat',
        postalCode: '389350',
        addressCountry: 'IN',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 22.5024,
        longitude: 73.4735,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '06:00',
          closes: '20:00',
        },
      ],
      areaServed: [
        { '@type': 'City', name: 'Halol' },
        { '@type': 'AdministrativeArea', name: 'Halol GIDC' },
        { '@type': 'AdministrativeArea', name: 'Baska GIDC' },
        { '@type': 'AdministrativeArea', name: 'Panchmahal' },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={`h-full bg-stone-50 text-slate-900 antialiased ${manrope.variable} ${notoGujarati.variable} ${baloo.variable} ${balooGujarati.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        <a href="#main-content" className="skip-link">Skip to Main Content</a>
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <main id="main-content" className="flex-1">{children}</main>
            <MobileBottomNav />
            <AuthModal />
            <CustomerProfileModal />
            <CartDrawer />
            <OrderSuccessModal />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
