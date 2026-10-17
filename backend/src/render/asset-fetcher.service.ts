import { Injectable, Logger } from '@nestjs/common';
import { ALLOWED_CDN_HOSTS } from '../shared/discord-cdn';

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Downloads avatars and banners from Discord's CDN. Only Discord CDN hosts are allowed
 * (prevents SSRF if a URL ever comes from user input) and results are cached in memory.
 */
@Injectable()
export class AssetFetcher {
  private readonly logger = new Logger(AssetFetcher.name);
  private readonly cache = new Map<string, { data: Buffer; expires: number }>();
  private readonly inflight = new Map<string, Promise<Buffer | null>>();

  async fetch(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_CDN_HOSTS.has(parsed.hostname)) {
      this.logger.warn(`Blocked asset URL host: ${parsed.hostname}`);
      return null;
    }

    const hit = this.cache.get(url);
    if (hit && hit.expires > Date.now()) return hit.data;

    const existing = this.inflight.get(url);
    if (existing) return existing;

    const promise = this.download(url).finally(() => this.inflight.delete(url));
    this.inflight.set(url, promise);
    return promise;
  }

  private async download(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      if (!(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
      const length = Number(res.headers.get('content-length') ?? 0);
      if (length > MAX_BYTES) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length > MAX_BYTES) return null;

      if (this.cache.size >= MAX_ENTRIES) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
      this.cache.set(url, { data, expires: Date.now() + TTL_MS });
      return data;
    } catch (err) {
      this.logger.debug(`Asset download failed: ${(err as Error).message}`);
      return null;
    }
  }
}
