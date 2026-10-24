import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE.url, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE.url}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
