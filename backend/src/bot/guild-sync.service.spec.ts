import { describe, expect, it, jest } from '@jest/globals';
import { DatabaseService } from '../db/database.service';
import { guildChannels, guildRoles } from '../db/schema';
import { DiscordRestService } from '../discord/discord-rest.service';
import { RedisService } from '../redis/redis.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { GUILD_CHANNELS_CHANGED_CHANNEL, GUILD_SYNCED_CHANNEL, guildChannelsCacheKey } from '../guilds/guild-events';
import { GuildSyncService } from './guild-sync.service';

function makeService(inserted = true) {
  const deletes: Array<{ table: unknown; condition: unknown }> = [];
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const makeInsert = (table: unknown) => ({
    values: jest.fn((values: unknown) => {
      inserts.push({ table, values });
      return {
        onConflictDoUpdate: jest.fn(async () => undefined),
        onConflictDoNothing: jest.fn(() => ({
          returning: jest.fn(async () => inserted ? [{ id: 'guild-123' }] : []),
        })),
      };
    }),
  });
  const tx = {
    insert: jest.fn((table: unknown) => makeInsert(table)),
    delete: jest.fn((table: unknown) => ({
      where: jest.fn(async (condition: unknown) => {
        deletes.push({ table, condition });
        return [];
      }),
    })),
  };
  const database = {
    db: {
      transaction: jest.fn(async (work: (transaction: unknown) => Promise<unknown>) => work(tx)),
      insert: jest.fn((table: unknown) => makeInsert(table)),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [{
              id: 'guild-123',
              name: 'Guild',
              iconHash: null,
              bannerHash: null,
              ownerId: 'owner-123',
              memberCount: 10,
              installed: true,
              joinedAt: new Date(),
              leftAt: null,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            }]),
          })),
        })),
      })),
      delete: jest.fn((table: unknown) => ({
        where: jest.fn(async (condition: unknown) => {
          deletes.push({ table, condition });
          return [];
        }),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(async () => [{ id: 'guild-123' }]),
          })),
        })),
      })),
    },
  } as unknown as DatabaseService;
  const redisClient = {
    set: jest.fn(async (..._args: unknown[]) => 'OK' as string | null),
    del: jest.fn(async (..._args: unknown[]) => 1),
    publish: jest.fn(async (..._args: unknown[]) => 1),
    incr: jest.fn(async (..._args: unknown[]) => 1),
  };
  const redis = { client: redisClient } as unknown as RedisService;
  const discord = {
    getGuildAsBot: jest.fn(async () => ({
      id: 'guild-123',
      name: 'Guild',
      icon: null,
      owner_id: 'owner-123',
      approximate_member_count: 10,
    })),
    getGuildChannels: jest.fn(async () => [
      { id: 'channel-live', name: 'general', type: 0, position: 1, parent_id: null },
    ]),
    getGuildRoles: jest.fn(async () => [
      { id: 'role-live', name: 'member', color: 0, position: 1 },
    ]),
  } as unknown as DiscordRestService;
  const settings = { get: jest.fn(async () => ({ welcome: {}, goodbye: {} })) } as unknown as SettingsCache;
  const stats = { incr: jest.fn(async (_name: string) => undefined) };
  const service = new GuildSyncService(database, redis, discord, settings, stats as never);
  return { service, database, redisClient, discord, stats, deletes, inserts };
}

describe('GuildSyncService', () => {
  it('syncs snapshots and removes channel and role rows absent from Discord', async () => {
    const { service, discord, redisClient, deletes, inserts } = makeService();

    const result = await service.syncGuild('guild-123');

    expect(result.channels).toEqual([{ id: 'channel-live', name: 'general', category: null }]);
    expect(result.roles).toEqual([{ id: 'role-live', name: 'member', color: 0, position: 1 }]);
    expect(discord.getGuildAsBot).toHaveBeenCalledWith('guild-123');
    expect(discord.getGuildChannels).toHaveBeenCalledWith('guild-123');
    expect(discord.getGuildRoles).toHaveBeenCalledWith('guild-123');
    expect(inserts.map(({ table }) => table)).toEqual(expect.arrayContaining([guildChannels, guildRoles]));
    expect(deletes.map(({ table }) => table)).toEqual(expect.arrayContaining([guildChannels, guildRoles]));
    expect(redisClient.set).toHaveBeenCalledWith(guildChannelsCacheKey('guild-123'), JSON.stringify(result.channels), 'EX', 3600);
    expect(redisClient.publish).toHaveBeenCalledWith(GUILD_SYNCED_CHANNEL, 'guild-123');
  });

  it('uses a distributed 30-second per-guild refresh cooldown', async () => {
    const { service, redisClient } = makeService();
    redisClient.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await expect(service.tryAcquireRefreshCooldown('guild-123')).resolves.toBe(true);
    await expect(service.tryAcquireRefreshCooldown('guild-123')).resolves.toBe(false);
    expect(redisClient.set).toHaveBeenCalledWith('guild:guild-123:refresh-cooldown', '1', 'EX', 30, 'NX');
  });

  it('records guild joins and leaves', async () => {
    const { service, stats, redisClient } = makeService();
    await expect(service.upsert({ id: 'guild-123' } as never)).resolves.toBe(true);
    await service.markLeft('guild-123');
    expect(stats.incr).toHaveBeenCalledWith('guild_joins');
    expect(stats.incr).toHaveBeenCalledWith('guild_leaves');
    expect(redisClient.incr).toHaveBeenCalledTimes(2);
    expect(redisClient.incr).toHaveBeenNthCalledWith(1, 'guild:guild-123:rev');
    expect(redisClient.incr).toHaveBeenNthCalledWith(2, 'guild:guild-123:rev');
  });

  it('reports an existing guild as not newly inserted', async () => {
    const { service, database } = makeService(false);

    await expect(service.upsert({ id: 'guild-123' } as never)).resolves.toBe(false);
    expect(database.db.update).toHaveBeenCalled();
  });

  it('invalidates the exact channel key after an incremental channel write', async () => {
    const { service, redisClient } = makeService();

    await service.upsertChannel('guild-123', {
      id: 'channel-new',
      name: 'new-channel',
      type: 0,
      position: 2,
      parent_id: null,
    });

    expect(redisClient.del).toHaveBeenCalledWith(
      guildChannelsCacheKey('guild-123'),
      `discord:cache:channels:guild-123`,
      'chan:channel-new',
    );
    expect(redisClient.publish).toHaveBeenCalledWith(GUILD_CHANNELS_CHANGED_CHANNEL, 'guild-123');
    expect(redisClient.incr).toHaveBeenCalledWith('guild:guild-123:rev');
    expect(redisClient.publish).toHaveBeenCalledWith(
      'guild:guild-123:events',
      JSON.stringify({
        type: 'updated',
        guildId: 'guild-123',
        kind: 'channels',
        data: { channelId: 'channel-new' },
        rev: 1,
      }),
    );
  });

  it('uses a safe position when a role-create event has no position yet', async () => {
    const { service, inserts } = makeService();

    await service.upsertRole('guild-123', { id: 'role-new', name: 'DexBotX', color: 0 });

    expect(inserts).toContainEqual({
      table: guildRoles,
      values: { guildId: 'guild-123', id: 'role-new', name: 'DexBotX', color: 0, position: 0 },
    });
  });
});
