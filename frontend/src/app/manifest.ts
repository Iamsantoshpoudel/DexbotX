import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DexBotX Discord Bot',
    short_name: SITE.brandName,
    description: SITE.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#171717',
    theme_color: '#8ab4f8',
    icons: [
      { src: '/icon-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
