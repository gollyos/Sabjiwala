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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#059669',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://sabjiwala.com'),
  title: {
    default: 'સબ્જીવાલા • Sabjiwala Halol | Fresh Daily Vegetables & Fruits Delivery',
    template: '%s | Sabjiwala Halol',
  },
  description: 'Farm-fresh vegetables and fruits delivered daily to your doorstep in Halol & Baska GIDC, Panchmahal. Order before 8 PM for 6 AM - 9 AM morning delivery. 10% OFF on first 3 orders.',
  keywords: [
    'sabjiwala halol',
    'sabji delivery halol',
    'fresh vegetables halol',
    'fresh fruits halol',
    'online sabji halol',
    'baska gidc vegetables',
    'halol panchmahal vegetable delivery',
    'તાજા શાકભાજી હાલોલ',
    'તાજા ફળો હાલોલ',
    'રોજિંદી શાકભાજી ડિલિવરી',
    'apmc mandi rate halol',
    'online fruit delivery halol',
  ],
  authors: [{ name: 'Sabjiwala Fresh Produce Team' }],
  creator: 'Sabjiwala Halol',
  publisher: 'Sabjiwala Halol',
  formatDetection: {
    telephone: true,
    address: true,
  },
  openGraph: {
    type: 'website',
    locale: 'gu_IN',
    url: 'https://sabjiwala.com',
    title: 'સબ્જીવાલા • Sabjiwala Halol | તાજા ફળો અને શાકભાજી',
    description: 'હાલોલ અને બાસ્કામાં રોજ સવારે ઘરબેઠા તાજા શાકભાજી અને ફળો મેળવો. ઓર્ડર કરો અને 10% ડિસ્કાઉન્ટ મેળવો.',
    siteName: 'Sabjiwala Halol',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200&auto=format&fit=crop&q=80',
        width: 1200,
        height: 630,
        alt: 'Sabjiwala Halol Fresh Fruits and Vegetables Delivery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'સબ્જીવાલા • Sabjiwala Halol | Fresh Fruits & Vegetables',
    description: 'Farm-fresh vegetables & fruits delivered daily in Halol & Baska GIDC. Order before 8 PM.',
    images: ['https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200&auto=format&fit=crop&q=80'],
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
      '@id': 'https://sabjiwala.com/#store',
      name: 'Sabjiwala Halol (સબ્જીવાલા)',
      description: 'Daily fresh fruits and vegetables procurement from APMC market with morning doorstep delivery in Halol and Baska GIDC, Panchmahal, Gujarat.',
      url: 'https://sabjiwala.com',
      telephone: '+919876543210',
      priceRange: '₹10 - ₹500',
      paymentAccepted: 'Cash, UPI, Online',
      currenciesAccepted: 'INR',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Baska / Halol Highway Road',
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
