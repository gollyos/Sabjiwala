import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://taazatokra.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/delivery-areas/halol'],
        disallow: ['/admin/', '/api/', '/driver/', '/track/', '/b/', '/profile/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
