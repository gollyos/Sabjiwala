import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Taji Tokri - Fresh Fruits & Vegetables Delivery (તાજી ટોકરી)',
    short_name: 'Taji Tokri',
    description: 'Fresh fruits and vegetables delivered in Halol. Taaza Phal, Taazi Sabzi — Seedha Ghar Tak.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#022c22',
    theme_color: '#059669',
    categories: ['shopping', 'food', 'lifestyle'],
    lang: 'gu-IN',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  };
}
