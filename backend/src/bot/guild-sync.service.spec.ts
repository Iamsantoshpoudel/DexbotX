import { describe, expect, it, jest } from '@jest/globals';
import { DatabaseService } from '../db/database.service';
import { guildChannels, guildRoles } from '../db/schema';
import { DiscordRestService } from '../discord/discord-rest.service';
import { RedisService } from '../redis/redis.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { GUILD_CHANNELS_CHANGED_CHANNEL, GUILD_SYNCED_CHANNEL, guildChannelsCacheKey } from '../guilds/guild-events';
import { GuildSyncService } from './guild-sync.service';

function makeService() {
  const deletes: Array<{ table: unknown; condition: unknown }> = [];
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const makeInsert = (table: unknown) => ({
    values: jest.fn((values: unknown) => {
      inserts.push({ table, values });
      return { onConflictDoUpdate: jest.fn(async () => undefined) };
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
    },
  } as unknown as DatabaseService;
  const redisClient = {
    set: jest.fn(async (..._args: unknown[]) => 'OK' as string | null),
    del: jest.fn(async (..._args: unknown[]) => 1),
    publish: jest.fn(async (..._args: unknown[]) => 1),
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
  const service = new GuildSyncService(database, redis, discord, settings);
  return { service, database, redisClient, discord, deletes, inserts };
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
    expect(redisClient.set).toHaveBeenCalledWith(guildChannelsCacheKey('guild-123'), JSON.stringify(result.channels), 'EX', 720);
    expect(redisClient.publish).toHaveBeenCalledWith(GUILD_SYNCED_CHANNEL, 'guild-123');
  });

  it('uses a distributed 30-second per-guild refresh cooldown', async () => {
    const { service, redisClient } = makeService();
    redisClient.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await expect(service.tryAcquireRefreshCooldown('guild-123')).resolves.toBe(true);
    await expect(service.tryAcquireRefreshCooldown('guild-123')).resolves.toBe(false);
    expect(redisClient.set).toHaveBeenCalledWith('guild:guild-123:refresh-cooldown', '1', 'EX', 30, 'NX');
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

    expect(redisClient.del).toHaveBeenCalledWith(guildChannelsCacheKey('guild-123'));
    expect(redisClient.publish).toHaveBeenCalledWith(GUILD_CHANNELS_CHANGED_CHANNEL, 'guild-123');
  });
});
