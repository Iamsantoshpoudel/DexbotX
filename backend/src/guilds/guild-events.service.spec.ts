import { describe, expect, it, jest } from '@jest/globals';
import { filter, firstValueFrom, take } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import {
  GUILD_CHANNELS_CHANGED_CHANNEL,
  GUILD_SYNCED_CHANNEL,
} from './guild-events';
import { GuildEventsService } from './guild-events.service';

describe('GuildEventsService', () => {
  it('relays Redis guild, channel, and settings changes to event stream subscribers', async () => {
    const handlers = new Map<string, (channel: string, message: string) => void>();
    const redis = {
      subscribe: jest.fn(async (channel: string, handler: (channel: string, message: string) => void) => {
        handlers.set(channel, handler);
      }),
    } as unknown as RedisService;
    const service = new GuildEventsService(redis);
    await service.onModuleInit();

    expect(redis.subscribe).toHaveBeenCalledTimes(5);

    const eventPromise = firstValueFrom(service.stream().pipe(filter((event) => event.type === 'channels_changed'), take(1)));
    handlers.get(GUILD_CHANNELS_CHANGED_CHANNEL)?.(GUILD_CHANNELS_CHANGED_CHANNEL, 'guild-123');
    await expect(eventPromise).resolves.toEqual({ type: 'channels_changed', data: { guildId: 'guild-123' } });

    const syncPromise = firstValueFrom(service.stream().pipe(filter((event) => event.type === 'guild_synced'), take(1)));
    handlers.get(GUILD_SYNCED_CHANNEL)?.(GUILD_SYNCED_CHANNEL, 'guild-123');
    await expect(syncPromise).resolves.toEqual({ type: 'guild_synced', data: { guildId: 'guild-123' } });
  });
});
