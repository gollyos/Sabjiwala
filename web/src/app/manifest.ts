import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaazaTokra - Fresh Fruits & Vegetables Delivery (તાજાટોકરા)',
    short_name: 'TaazaTokra',
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
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/favicon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  };
}
