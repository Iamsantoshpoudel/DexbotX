const CDN = 'https://cdn.discordapp.com';

export const ALLOWED_CDN_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

export function userAvatarUrl(userId: string, hash: string | null | undefined, size = 256): string {
  if (hash) return `${CDN}/avatars/${userId}/${hash}.png?size=${size}`;
  const index = Number((BigInt(userId) >> 22n) % 6n);
  return `${CDN}/embed/avatars/${index}.png`;
}

export function guildIconUrl(guildId: string, hash: string | null | undefined, size = 128): string | null {
  return hash ? `${CDN}/icons/${guildId}/${hash}.png?size=${size}` : null;
}

export function guildBannerUrl(guildId: string, hash: string | null | undefined, size = 1024): string | null {
  return hash ? `${CDN}/banners/${guildId}/${hash}.png?size=${size}` : null;
}
