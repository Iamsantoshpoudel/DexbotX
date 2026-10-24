import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { userAvatarUrl } from '../shared/discord-cdn';
import { PRESETS } from '../shared/presets';
import type { MessageConfig } from '../shared/message-config';
import { DatabaseService } from '../db/database.service';
import { guildSettings } from '../db/schema';
import { RedisService } from '../redis/redis.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { AssetStorage, BACKGROUND_PATH_RE } from '../storage/asset-storage.service';
import { AdminAuditService } from './admin-audit.service';
import { FeatureFlags, FeatureFlagsService } from '../core/feature-flags.service';

@Injectable()
export class AdminUsersContentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly settings: SettingsCache,
    private readonly storage: AssetStorage,
    private readonly audit: AdminAuditService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async users() {
    const [logins, activeSessions] = await Promise.all([
      this.redis.client.lrange('stat:ev:recent_logins', 0, 49),
      this.activeSessionCount(),
    ]);
    return {
      recentLogins: logins.map((raw) => {
        const login = JSON.parse(raw) as { id: string; username: string; avatarHash?: string | null };
        return {
          id: login.id,
          username: login.username,
          avatar: userAvatarUrl(login.id, login.avatarHash, 128),
        };
      }),
      activeSessions,
    };
  }

  async revokeUser(adminId: string, userId: string) {
    if (!/^\d{17,20}$/.test(userId)) throw new NotFoundException();
    const keys = await this.scanSessionKeys();
    const removed: string[] = [];
    for (let start = 0; start < keys.length; start += 200) {
      const batch = keys.slice(start, start + 200);
      const values = await this.redis.client.mget(...batch);
      values.forEach((value, index) => {
        if (!value) return;
        try {
          const session = JSON.parse(value) as { userId?: string };
          if (session.userId === userId) removed.push(batch[index]);
        } catch {
          return;
        }
      });
    }
    if (removed.length) await this.redis.client.del(...removed);
    await this.redis.client.del('admin:users:active-sessions');
    await this.audit.log(adminId, 'user.revoke_sessions', userId, { revoked: removed.length });
    return { revoked: removed.length };
  }

  async content() {
    const settings = await this.database.db.select().from(guildSettings);
    const presetUsage = PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.name,
      uses: settings.reduce((total, row) => {
        const config = preset.kind === 'welcome' ? row.welcome : row.goodbye;
        return total + (matchesPreset(config, preset.config) ? 1 : 0);
      }, 0),
    }));
    return { presetUsage, backgrounds: await this.storage.listBackgrounds() };
  }

  async deleteBackground(adminId: string, path: string, confirmed: boolean) {
    if (!confirmed) throw new BadRequestException('Confirmation required');
    if (!BACKGROUND_PATH_RE.test(path)) throw new BadRequestException('Invalid background path');
    await this.storage.deleteBackground(path);

    const guildId = path.split('/')[0];
    const rows = await this.database.db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId));
    const row = rows[0];
    if (row) {
      const welcome = clearBackground(row.welcome, path);
      const goodbye = clearBackground(row.goodbye, path);
      if (welcome !== row.welcome || goodbye !== row.goodbye) {
        await this.database.db.update(guildSettings).set({
          welcome,
          goodbye,
          updatedBy: adminId,
          updatedAt: new Date(),
        }).where(eq(guildSettings.guildId, guildId));
        await this.settings.invalidate(guildId);
      }
    }
    await this.audit.log(adminId, 'content.delete_background', path, { guildId });
    return { ok: true };
  }

  async getFlags(): Promise<FeatureFlags> {
    return this.flags.get();
  }

  async updateFlags(adminId: string, input: unknown): Promise<FeatureFlags> {
    const parsed = this.flags.validate(input);
    await this.flags.update(parsed);
    await this.audit.log(adminId, 'settings.update_flags', 'flags', parsed);
    return parsed;
  }

  private async activeSessionCount(): Promise<number> {
    const cached = await this.redis.client.get('admin:users:active-sessions');
    if (cached !== null) return Number(cached);
    const keys = await this.scanSessionKeys();
    let count = 0;
    for (let start = 0; start < keys.length; start += 200) {
      const values = await this.redis.client.mget(...keys.slice(start, start + 200));
      count += values.filter((value) => value !== null).length;
    }
    await this.redis.client.set('admin:users:active-sessions', String(count), 'EX', 30);
    return count;
  }

  private async scanSessionKeys(): Promise<string[]> {
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [next, batch] = await this.redis.client.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 500);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }
}

function matchesPreset(value: unknown, preset: Record<string, unknown>): boolean {
  if (!value || typeof value !== 'object') return false;
  const config = value as Record<string, unknown>;
  return ['content', 'embed', 'image'].every((key) =>
    JSON.stringify(config[key]) === JSON.stringify(preset[key]));
}

function clearBackground(config: MessageConfig, path: string): MessageConfig {
  return config.image.backgroundPath === path
    ? { ...config, image: { ...config.image, backgroundPath: null } }
    : config;
}
