import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../core/config';

export const BACKGROUND_PATH_RE = /^\d{17,20}\/[0-9a-f]{64}\.jpg$/;
const MAX_BYTES = 4 * 1024 * 1024;
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 100;

/**
 * Custom card backgrounds in a PRIVATE Supabase Storage bucket.
 * Only this backend (service key) can read or write; paths are validated before any request,
 * so a stored value can never be turned into an arbitrary URL.
 */
@Injectable()
export class AssetStorage {
  private readonly logger = new Logger(AssetStorage.name);
  private readonly cache = new Map<string, { data: Buffer; expires: number }>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return Boolean(this.config.supabaseUrl && this.config.supabaseServiceKey);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const key = this.config.supabaseServiceKey!;
    return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
  }

  private objectUrl(path: string): string {
    return `${this.config.supabaseUrl}/storage/v1/object/${this.config.supabaseBucket}/${path}`;
  }

  async put(path: string, data: Buffer): Promise<void> {
    if (!this.enabled) throw new ServiceUnavailableException('Uploads are not configured on this server');
    if (!BACKGROUND_PATH_RE.test(path)) throw new Error('invalid storage path');

    const upload = () =>
      fetch(this.objectUrl(path), {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': 'private, max-age=3600' }),
        body: new Uint8Array(data),
        signal: AbortSignal.timeout(15_000),
      });

    let res = await upload();
    if (res.status === 404 || res.status === 400) {
      // First use: create the private bucket, then retry once.
      const created = await fetch(`${this.config.supabaseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: this.config.supabaseBucket, name: this.config.supabaseBucket, public: false }),
        signal: AbortSignal.timeout(10_000),
      });
      if (created.ok || created.status === 409) res = await upload();
    }
    if (!res.ok) {
      this.logger.error(`Storage upload failed: ${res.status}`);
      throw new ServiceUnavailableException('Could not store the image right now. Try again shortly.');
    }
    this.remember(path, data);
  }

  /** Returns null (never throws) so a storage outage degrades to the normal card background. */
  async get(path: string | null | undefined): Promise<Buffer | null> {
    if (!path || !this.enabled || !BACKGROUND_PATH_RE.test(path)) return null;
    const hit = this.cache.get(path);
    if (hit && hit.expires > Date.now()) return hit.data;
    try {
      const res = await fetch(this.objectUrl(path), { headers: this.headers(), signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length > MAX_BYTES) return null;
      this.remember(path, data);
      return data;
    } catch (err) {
      this.logger.debug(`Storage read failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Best effort: a leftover object is harmless, a failed request must not break saving settings. */
  async remove(path: string): Promise<void> {
    if (!this.enabled || !BACKGROUND_PATH_RE.test(path)) return;
    this.cache.delete(path);
    try {
      await fetch(`${this.config.supabaseUrl}/storage/v1/object/${this.config.supabaseBucket}`, {
        method: 'DELETE',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prefixes: [path] }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      this.logger.debug(`Storage delete failed: ${(err as Error).message}`);
    }
  }

  async listBackgrounds(): Promise<Array<{ path: string; guildId: string; size: number; uploadedAt: string | null }>> {
    if (!this.enabled) return [];
    const backgrounds: Array<{ path: string; guildId: string; size: number; uploadedAt: string | null }> = [];
    const roots = await this.listObjects('');
    for (const folder of roots.filter((entry) => entry.id === null && /^\d{17,20}$/.test(entry.name))) {
      const guildId = folder.name;
      const objects = await this.listObjects(`${guildId}/`);
      for (const object of objects) {
        const path = `${guildId}/${object.name}`;
        if (!BACKGROUND_PATH_RE.test(path)) continue;
        backgrounds.push({
          path,
          guildId,
          size: Number(object.metadata?.size ?? object.metadata?.contentLength ?? 0),
          uploadedAt: object.created_at ?? object.updated_at ?? null,
        });
      }
    }
    return backgrounds;
  }

  async deleteBackground(path: string): Promise<void> {
    if (!this.enabled) throw new ServiceUnavailableException('Uploads are not configured on this server');
    if (!BACKGROUND_PATH_RE.test(path)) throw new Error('invalid storage path');
    const response = await fetch(`${this.config.supabaseUrl}/storage/v1/object/${this.config.supabaseBucket}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: [path] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      this.logger.error(`Storage delete failed: ${response.status}`);
      throw new ServiceUnavailableException('Could not delete the background right now.');
    }
    this.cache.delete(path);
  }

  private async listObjects(prefix: string): Promise<Array<{
    id: string | null;
    name: string;
    created_at?: string;
    updated_at?: string;
    metadata?: Record<string, unknown>;
  }>> {
    const response = await fetch(`${this.config.supabaseUrl}/storage/v1/object/list/${this.config.supabaseBucket}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      this.logger.error(`Storage list failed: ${response.status}`);
      throw new ServiceUnavailableException('Could not list stored backgrounds right now.');
    }
    const result: unknown = await response.json();
    if (!Array.isArray(result)) throw new ServiceUnavailableException('Storage returned an invalid object list.');
    return result as Array<{
      id: string | null;
      name: string;
      created_at?: string;
      updated_at?: string;
      metadata?: Record<string, unknown>;
    }>;
  }

  private remember(path: string, data: Buffer): void {
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(path, { data, expires: Date.now() + TTL_MS });
  }
}
