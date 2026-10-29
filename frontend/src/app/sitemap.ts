import type { MetadataRoute } from 'next';
import { FEATURE_PAGES } from '@/lib/seo';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE.url, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/about`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE.url}/commands`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE.url}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    ...FEATURE_PAGES.map(({ slug }) => ({
      url: `${SITE.url}/features/${slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${SITE.url}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE.url}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
