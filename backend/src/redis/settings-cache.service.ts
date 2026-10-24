import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { guildSettings } from '../db/schema';
import {
  defaultGuildMessages,
  GuildMessages,
  MessageKind,
  normalizeMessageConfig,
} from '../shared/message-config';
import { GUILD_SETTINGS_CHANGED_CHANNEL, guildSettingsCacheKey } from '../guilds/guild-events';
import { RedisService } from './redis.service';
import { StatsService } from '../admin/stats.service';

const REDIS_TTL_SECONDS = 60 * 60;
const L1_TTL_MS = 60 * 1000;
const L1_MAX_ENTRIES = 5000;

interface L1Entry {
  value: GuildMessages;
  expires: number;
}

/**
 * Guild settings read path used on every member join.
 * L1 = in-process map (60s), L2 = Redis (1h), source of truth = Postgres.
 * Writers call invalidate(); pub/sub clears the L1 map in every API instance and bot shard.
 */
@Injectable()
export class SettingsCache implements OnModuleInit {
  private readonly logger = new Logger(SettingsCache.name);
  private readonly l1 = new Map<string, L1Entry>();

  constructor(
    private readonly redis: RedisService,
    private readonly database: DatabaseService,
    private readonly stats: StatsService,
  ) {}

  onModuleInit(): void {
    const sub = this.redis.createSubscriber();
    sub.subscribe(GUILD_SETTINGS_CHANGED_CHANNEL).catch((err) => this.logger.error(`Subscribe failed: ${err.message}`));
    sub.on('message', (channel, guildId) => {
      if (channel === GUILD_SETTINGS_CHANGED_CHANNEL) this.l1.delete(guildId);
    });
  }

  async get(guildId: string): Promise<GuildMessages> {
    const now = Date.now();
    const hit = this.l1.get(guildId);
    if (hit && hit.expires > now) {
      await this.stats.hit('settings');
      return hit.value;
    }

    let value: GuildMessages | null = null;
    try {
      const cached = await this.redis.client.get(guildSettingsCacheKey(guildId));
      if (cached) {
        value = this.parse(JSON.parse(cached));
        await this.stats.hit('settings');
      }
    } catch (err) {
      this.logger.warn(`Redis read failed for ${guildId}: ${(err as Error).message}`);
    }

    if (!value) {
      await this.stats.miss('settings');
      value = await this.loadFromDb(guildId);
      this.redis.client
        .set(guildSettingsCacheKey(guildId), JSON.stringify(value), 'EX', REDIS_TTL_SECONDS)
        .catch((err) => this.logger.warn(`Redis write failed for ${guildId}: ${err.message}`));
    }

    this.setL1(guildId, value);
    return value;
  }

  async invalidate(guildId: string): Promise<void> {
    this.l1.delete(guildId);
    await this.redis.client.del(guildSettingsCacheKey(guildId));
    await this.redis.client.publish(GUILD_SETTINGS_CHANGED_CHANNEL, guildId);
  }

  private parse(raw: unknown): GuildMessages {
    const r = (raw ?? {}) as Partial<Record<MessageKind, unknown>>;
    return { welcome: normalizeMessageConfig('welcome', r.welcome), goodbye: normalizeMessageConfig('goodbye', r.goodbye) };
  }

  private async loadFromDb(guildId: string): Promise<GuildMessages> {
    const rows = await this.database.db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
    const row = rows[0];
    if (!row) return defaultGuildMessages();
    return this.parse({ welcome: row.welcome, goodbye: row.goodbye });
  }

  private setL1(guildId: string, value: GuildMessages): void {
    if (this.l1.size >= L1_MAX_ENTRIES) {
      const oldest = this.l1.keys().next().value;
      if (oldest) this.l1.delete(oldest);
    }
    this.l1.set(guildId, { value, expires: Date.now() + L1_TTL_MS });
  }
}
