import { describe, expect, it, jest } from '@jest/globals';
import { filter, firstValueFrom, take } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import {
  GUILD_CHANNELS_CHANGED_CHANNEL,
  GUILD_MEMBERSHIP_EVENTS_CHANNEL,
  GUILD_ROLES_CHANGED_CHANNEL,
  GUILD_SETTINGS_CHANGED_CHANNEL,
  GUILD_SYNCED_CHANNEL,
} from './guild-events';
import { GuildEventsService } from './guild-events.service';

describe('GuildEventsService', () => {
  it('relays Redis guild, channel, and settings changes to event stream subscribers', async () => {
    let onRedisMessage: ((channel: string, message: string) => void) | undefined;
    const subscriber = {
      on: jest.fn((event: string, listener: (channel: string, message: string) => void) => {
        if (event === 'message') onRedisMessage = listener;
        return subscriber;
      }),
      subscribe: jest.fn(async (..._channels: string[]) => 3),
    };
    const redis = { createSubscriber: jest.fn(() => subscriber) } as unknown as RedisService;
    const service = new GuildEventsService(redis);
    await service.onModuleInit();

    expect(subscriber.subscribe).toHaveBeenCalledWith(
      GUILD_MEMBERSHIP_EVENTS_CHANNEL,
      GUILD_CHANNELS_CHANGED_CHANNEL,
      GUILD_SETTINGS_CHANGED_CHANNEL,
      GUILD_ROLES_CHANGED_CHANNEL,
      GUILD_SYNCED_CHANNEL,
    );

    const eventPromise = firstValueFrom(service.stream().pipe(filter((event) => event.type === 'channels_changed'), take(1)));
    onRedisMessage?.(GUILD_CHANNELS_CHANGED_CHANNEL, 'guild-123');
    await expect(eventPromise).resolves.toEqual({ type: 'channels_changed', data: { guildId: 'guild-123' } });

    const syncPromise = firstValueFrom(service.stream().pipe(filter((event) => event.type === 'guild_synced'), take(1)));
    onRedisMessage?.(GUILD_SYNCED_CHANNEL, 'guild-123');
    await expect(syncPromise).resolves.toEqual({ type: 'guild_synced', data: { guildId: 'guild-123' } });
  });
});
