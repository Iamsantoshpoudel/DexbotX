import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.brandName,
    short_name: SITE.brandName,
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#171717',
    theme_color: '#8ab4f8',
    icons: [
      { src: '/icon.png', sizes: '867x879', type: 'image/png' },
      { src: '/maskable-icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
