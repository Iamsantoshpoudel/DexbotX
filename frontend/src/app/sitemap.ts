import type { MetadataRoute } from 'next';
import { FEATURE_PAGES } from '@/lib/seo';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE.siteUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.siteUrl}/features`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE.siteUrl}/about`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE.siteUrl}/commands`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE.siteUrl}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    ...FEATURE_PAGES.map(({ slug }) => ({
      url: `${SITE.siteUrl}/features/${slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${SITE.siteUrl}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE.siteUrl}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
