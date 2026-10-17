import type { ImageStyleId } from './types';

/** Gradient stops copied from the backend card renderer, used for swatches and the landing-page mock. */
export const IMAGE_STYLES: Record<ImageStyleId, { label: string; stops: string[] }> = {
  midnight: { label: 'Midnight', stops: ['#0d0e2b', '#1a1a4a', '#2b2070'] },
  sunset: { label: 'Sunset', stops: ['#241030', '#6b2542', '#d9622b'] },
  aurora: { label: 'Aurora', stops: ['#04141c', '#0a3438', '#0f4f48'] },
  neon: { label: 'Neon', stops: ['#06030f', '#140a2c', '#0a1838'] },
  ocean: { label: 'Ocean', stops: ['#04122a', '#0a2c58', '#0d5384'] },
  minimal: { label: 'Minimal', stops: ['#14161b', '#1b1e25'] },
};

export const gradientFor = (id: ImageStyleId): string =>
  `linear-gradient(135deg, ${IMAGE_STYLES[id].stops.join(', ')})`;
