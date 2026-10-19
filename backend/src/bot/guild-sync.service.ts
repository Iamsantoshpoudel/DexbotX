import { Injectable, Logger } from '@nestjs/common';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { Guild } from 'discord.js';
import { DatabaseService } from '../db/database.service';
import { guildChannels, guildRoles, guilds } from '../db/schema';
import { DiscordApiError, DiscordChannel, DiscordRestService } from '../discord/discord-rest.service';
import {
  GUILD_CHANNELS_CHANGED_CHANNEL,
  GUILD_MEMBERSHIP_EVENTS_CHANNEL,
  GUILD_ROLES_CHANGED_CHANNEL,
  GUILD_SYNCED_CHANNEL,
  guildChannelsCacheKey,
  guildMetaCacheKey,
  guildRolesCacheKey,
  guildSettingsCacheKey,
} from '../guilds/guild-events';
import { RedisService } from '../redis/redis.service';
import { SettingsCache } from '../redis/settings-cache.service';

const CHANNELS_TTL_SECONDS = 12 * 60;
const ROLES_TTL_SECONDS = 12 * 60;
const META_TTL_SECONDS = 15 * 60;
const REFRESH_COOLDOWN_SECONDS = 30;

export interface CachedChannel {
  id: string;
  name: string;
  category: string | null;
}

export interface CachedRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface GuildSyncResult {
  guild: { id: string; name: string; icon: string | null; ownerId: string | null; memberCount: number };
  channels: CachedChannel[];
  roles: CachedRole[];
  lastSyncedAt: string;
}

@Injectable()
export class GuildSyncService {
  private readonly logger = new Logger(GuildSyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly discord: DiscordRestService,
    private readonly settings: SettingsCache,
  ) {}

  private toGuildRow(g: Guild) {
    return {
      id: g.id,
      name: g.name,
      iconHash: g.icon,
      bannerHash: g.banner,
      ownerId: g.ownerId,
      memberCount: g.memberCount,
      installed: true,
      leftAt: null,
      updatedAt: new Date(),
    };
  }

  async upsertMany(list: Guild[]): Promise<void> {
    for (let i = 0; i < list.length; i += 200) {
      const rows = list.slice(i, i + 200).map((g) => this.toGuildRow(g));
      await this.database.db
        .insert(guilds)
        .values(rows)
        .onConflictDoUpdate({
          target: guilds.id,
          set: {
            name: sql`excluded.name`,
            iconHash: sql`excluded.icon`,
            bannerHash: sql`excluded.banner_hash`,
            ownerId: sql`excluded.owner_id`,
            memberCount: sql`excluded.member_count`,
            installed: true,
            leftAt: null,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      await Promise.all(rows.map(({ id }) => this.redis.client.del(guildMetaCacheKey(id))));
    }
    this.logger.log(`Synced ${list.length} guild(s)`);
  }

  async upsert(g: Guild): Promise<void> {
    await this.upsertMany([g]);
    await this.redis.client.publish(GUILD_MEMBERSHIP_EVENTS_CHANNEL, g.id);
  }

  async notifyReconciled(): Promise<void> {
    await this.redis.client.publish(GUILD_MEMBERSHIP_EVENTS_CHANNEL, '*');
  }

  async markLeft(guildId: string): Promise<void> {
    const updated = await this.database.db
      .update(guilds)
      .set({ installed: false, leftAt: new Date(), updatedAt: new Date() })
      .where(and(eq(guilds.id, guildId), eq(guilds.installed, true)))
      .returning({ id: guilds.id });
    if (updated.length > 0) {
      await this.redis.client.del(guildMetaCacheKey(guildId));
      await this.redis.client.publish(GUILD_MEMBERSHIP_EVENTS_CHANNEL, guildId);
    }
  }

  async tryAcquireRefreshCooldown(guildId: string): Promise<boolean> {
    const result = await this.redis.client.set(`guild:${guildId}:refresh-cooldown`, '1', 'EX', REFRESH_COOLDOWN_SECONDS, 'NX');
    return result === 'OK';
  }

  async getRoles(guildId: string): Promise<CachedRole[]> {
    const key = guildRolesCacheKey(guildId);
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached) as CachedRole[];
    const rows = await this.database.db
      .select({ id: guildRoles.id, name: guildRoles.name, color: guildRoles.color, position: guildRoles.position })
      .from(guildRoles)
      .where(eq(guildRoles.guildId, guildId))
      .orderBy(guildRoles.position);
    await this.redis.client.set(key, JSON.stringify(rows), 'EX', ROLES_TTL_SECONDS);
    return rows;
  }

  async syncGuild(guildId: string): Promise<GuildSyncResult> {
    let guild;
    try {
      guild = await this.withRateLimitBackoff(() => this.discord.getGuildAsBot(guildId));
    } catch (error) {
      if (error instanceof DiscordApiError && error.status === 404 && error.discordCode === 10004) {
        await this.markLeft(guildId);
      }
      throw error;
    }
    const rawChannels = await this.withRateLimitBackoff(() => this.discord.getGuildChannels(guildId));
    const rawRoles = await this.withRateLimitBackoff(() => this.discord.getGuildRoles(guildId));
    const categories = new Map(rawChannels.filter((channel) => channel.type === 4).map((channel) => [channel.id, channel.name]));
    const channels = rawChannels
      .filter((channel) => channel.type === 0 || channel.type === 5)
      .sort((a, b) => a.position - b.position)
      .map((channel) => toCachedChannel(channel, categories));
    const roles: CachedRole[] = rawRoles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
    }));
    const lastSyncedAt = new Date();

    await this.database.db.transaction(async (tx) => {
      await tx
        .insert(guilds)
        .values({
          id: guild.id,
          name: guild.name,
          iconHash: guild.icon,
          bannerHash: guild.banner ?? null,
          ownerId: guild.owner_id ?? null,
          memberCount: guild.approximate_member_count ?? 0,
          installed: true,
          leftAt: null,
          lastSyncedAt,
          updatedAt: lastSyncedAt,
        })
        .onConflictDoUpdate({
          target: guilds.id,
          set: {
            name: sql`excluded.name`,
            iconHash: sql`excluded.icon`,
            bannerHash: sql`excluded.banner_hash`,
            ownerId: sql`excluded.owner_id`,
            memberCount: sql`excluded.member_count`,
            installed: true,
            leftAt: null,
            lastSyncedAt,
            updatedAt: lastSyncedAt,
          },
        });

      if (rawChannels.length) {
        await tx
          .insert(guildChannels)
          .values(rawChannels.map((channel) => toChannelRow(guildId, channel)))
          .onConflictDoUpdate({
            target: [guildChannels.guildId, guildChannels.id],
            set: {
              name: sql`excluded.name`,
              type: sql`excluded.type`,
              parentId: sql`excluded.parent_id`,
              position: sql`excluded.position`,
            },
          });
        await tx.delete(guildChannels).where(and(eq(guildChannels.guildId, guildId), notInArray(guildChannels.id, rawChannels.map((channel) => channel.id))));
      } else {
        await tx.delete(guildChannels).where(eq(guildChannels.guildId, guildId));
      }

      if (roles.length) {
        await tx
          .insert(guildRoles)
          .values(roles.map((role) => ({ guildId, ...role })))
          .onConflictDoUpdate({
            target: [guildRoles.guildId, guildRoles.id],
            set: { name: sql`excluded.name`, color: sql`excluded.color`, position: sql`excluded.position` },
          });
        await tx.delete(guildRoles).where(and(eq(guildRoles.guildId, guildId), notInArray(guildRoles.id, roles.map((role) => role.id))));
      } else {
        await tx.delete(guildRoles).where(eq(guildRoles.guildId, guildId));
      }
    });

    const result: GuildSyncResult = {
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.owner_id ?? null,
        memberCount: guild.approximate_member_count ?? 0,
      },
      channels,
      roles,
      lastSyncedAt: lastSyncedAt.toISOString(),
    };
    const persistedGuild = await this.database.db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
    if (!persistedGuild[0]) throw new Error(`Guild ${guildId} was not persisted during sync`);
    const settings = await this.settings.get(guildId);
    await Promise.all([
      this.redis.client.set(guildMetaCacheKey(guildId), JSON.stringify(persistedGuild[0]), 'EX', META_TTL_SECONDS),
      this.redis.client.set(guildChannelsCacheKey(guildId), JSON.stringify(channels), 'EX', CHANNELS_TTL_SECONDS),
      this.redis.client.set(guildRolesCacheKey(guildId), JSON.stringify(roles), 'EX', ROLES_TTL_SECONDS),
      this.redis.client.set(guildSettingsCacheKey(guildId), JSON.stringify(settings), 'EX', 60 * 60),
      this.redis.client.publish(GUILD_CHANNELS_CHANGED_CHANNEL, guildId),
      this.redis.client.publish(GUILD_ROLES_CHANGED_CHANNEL, guildId),
      this.redis.client.publish(GUILD_SYNCED_CHANNEL, guildId),
    ]);
    return result;
  }

  async upsertChannel(guildId: string, channel: DiscordChannel): Promise<void> {
    await this.database.db
      .insert(guildChannels)
      .values(toChannelRow(guildId, channel))
      .onConflictDoUpdate({
        target: [guildChannels.guildId, guildChannels.id],
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          parentId: sql`excluded.parent_id`,
          position: sql`excluded.position`,
        },
      });
    await this.invalidateChannels(guildId);
  }

  async deleteChannel(guildId: string, channelId: string): Promise<void> {
    await this.database.db.delete(guildChannels).where(and(eq(guildChannels.guildId, guildId), eq(guildChannels.id, channelId)));
    await this.invalidateChannels(guildId);
  }

  async upsertRole(guildId: string, role: CachedRole): Promise<void> {
    await this.database.db
      .insert(guildRoles)
      .values({ guildId, ...role })
      .onConflictDoUpdate({
        target: [guildRoles.guildId, guildRoles.id],
        set: { name: sql`excluded.name`, color: sql`excluded.color`, position: sql`excluded.position` },
      });
    await this.invalidateRoles(guildId);
  }

  async deleteRole(guildId: string, roleId: string): Promise<void> {
    await this.database.db.delete(guildRoles).where(and(eq(guildRoles.guildId, guildId), eq(guildRoles.id, roleId)));
    await this.invalidateRoles(guildId);
  }

  async guildUpdated(g: Guild): Promise<void> {
    await this.upsert(g);
    await this.redis.client.del(guildMetaCacheKey(g.id));
  }

  private async invalidateChannels(guildId: string): Promise<void> {
    await this.redis.client.del(guildChannelsCacheKey(guildId));
    await this.redis.client.publish(GUILD_CHANNELS_CHANGED_CHANNEL, guildId);
  }

  private async invalidateRoles(guildId: string): Promise<void> {
    await this.redis.client.del(guildRolesCacheKey(guildId));
    await this.redis.client.publish(GUILD_ROLES_CHANGED_CHANNEL, guildId);
  }

  private async withRateLimitBackoff<T>(request: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await request();
      } catch (error) {
        if (!(error instanceof DiscordApiError) || error.status !== 429 || attempt >= 2) throw error;
        const delayMs = Math.max(1, (error.retryAfter ?? 1) * 1000);
        this.logger.warn(`Discord rate limit hit; retrying guild sync in ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

function toChannelRow(guildId: string, channel: DiscordChannel) {
  return {
    guildId,
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parent_id,
    position: channel.position,
  };
}

function toCachedChannel(channel: DiscordChannel, categories: Map<string, string>): CachedChannel {
  return { id: channel.id, name: channel.name, category: channel.parent_id ? (categories.get(channel.parent_id) ?? null) : null };
}
