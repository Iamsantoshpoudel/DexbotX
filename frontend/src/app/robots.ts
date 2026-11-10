import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/og-banner', '/assets/', '/dexbotx-banner.gif'],
      disallow: ['/dashboard', '/api', '/admin'],
    },
    sitemap: `${SITE.siteUrl}/sitemap.xml`,
    host: SITE.siteUrl,
  };
}
