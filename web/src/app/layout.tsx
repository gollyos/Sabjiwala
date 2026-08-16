import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { CustomerProfileModal } from '@/components/CustomerProfileModal';
import { CartDrawer } from '@/components/CartDrawer';
import { OrderSuccessModal } from '@/components/OrderSuccessModal';

export const metadata: Metadata = {
  title: 'સબ્જીવાલા • Sabjiwala Halol | Fresh Daily Vegetables Delivery',
  description: 'Farm-fresh vegetables delivered daily to your doorstep in Halol, Panchmahal. Order before 8 PM for 10 AM-1 PM morning delivery.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900 antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
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
