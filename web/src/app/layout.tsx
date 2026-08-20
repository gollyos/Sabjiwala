import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { CustomerProfileModal } from '@/components/CustomerProfileModal';
import { CartDrawer } from '@/components/CartDrawer';
import { OrderSuccessModal } from '@/components/OrderSuccessModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://taazatokra.com';

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
    default: 'TaazaTokra | Fresh Fruits & Vegetables Delivery in Halol (તાજાટોકરા)',
    template: '%s | TaazaTokra Halol',
  },
  description: 'Order fresh fruits and vegetables online in Halol from TaazaTokra (તાજાટોકરા). Taaza Phal, Taazi Sabzi — Seedha Ghar Tak. Convenient doorstep delivery with COD.',
  keywords: [
    'TaazaTokra',
    'TaazaTokra Halol',
    'તાજાટોકરા',
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
  authors: [{ name: 'TaazaTokra Fresh Produce Team' }],
  creator: 'TaazaTokra',
  publisher: 'TaazaTokra Halol',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/icon.svg'],
  },
  manifest: '/manifest.webmanifest',
  formatDetection: {
    telephone: true,
    address: true,
  },
  openGraph: {
    type: 'website',
    locale: 'gu_IN',
    url: siteUrl,
    title: 'TaazaTokra • તાજાટોકરા | Fresh Fruits & Vegetables Delivery in Halol',
    description: 'Taaza Phal, Taazi Sabzi — Seedha Ghar Tak. Order fresh fruits & vegetables daily in Halol with Cash on Delivery.',
    siteName: 'TaazaTokra',
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'TaazaTokra Fresh Fruits and Vegetables Delivery in Halol',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaazaTokra • તાજાટોકરા | Fresh Fruits & Vegetables in Halol',
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
      name: 'TaazaTokra (તાજાટોકરા)',
      alternateName: 'TaazaTokra Halol',
      description: 'Fresh fruits and vegetables delivery in Halol, Panchmahal, Gujarat. Taaza Phal, Taazi Sabzi — Seedha Ghar Tak.',
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      image: `${siteUrl}/opengraph-image`,
      telephone: '+919876543210',
      priceRange: '₹10 - ₹500',
      paymentAccepted: 'Cash on Delivery (COD)',
      currenciesAccepted: 'INR',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Shop No. 4, APMC Market Road',
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
    <html lang="gu" className="h-full bg-slate-50 text-slate-900 antialiased">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
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
