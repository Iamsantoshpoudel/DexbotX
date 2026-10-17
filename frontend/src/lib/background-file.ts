export const MAX_BACKGROUND_BYTES = 2 * 1024 * 1024;
export const ALLOWED_BACKGROUND_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Client-side pre-check. The server validates and re-encodes the image again. Returns an error text or null. */
export function checkBackgroundFile(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_BACKGROUND_TYPES as readonly string[]).includes(file.type)) return 'Use a PNG, JPEG or WebP image.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_BACKGROUND_BYTES) return 'The image must be 2 MB or smaller.';
  return null;
}
