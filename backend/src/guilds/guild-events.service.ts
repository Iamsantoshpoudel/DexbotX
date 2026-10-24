import { Injectable, MessageEvent, OnModuleInit } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import {
  GUILD_CHANNELS_CHANGED_CHANNEL,
  GUILD_MEMBERSHIP_EVENTS_CHANNEL,
  GUILD_ROLES_CHANGED_CHANNEL,
  GUILD_SETTINGS_CHANGED_CHANNEL,
  GUILD_SYNCED_CHANNEL,
} from './guild-events';

@Injectable()
export class GuildEventsService implements OnModuleInit {
  private readonly changes = new Subject<MessageEvent>();

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    const dispatch = (channel: string, message: string) => {
      if (channel === GUILD_CHANNELS_CHANGED_CHANNEL) {
        this.changes.next({ type: 'channels_changed', data: { guildId: message } });
      } else if (channel === GUILD_SETTINGS_CHANGED_CHANNEL) {
        this.changes.next({ type: 'settings_changed', data: { guildId: message } });
      } else if (channel === GUILD_ROLES_CHANGED_CHANNEL) {
        this.changes.next({ type: 'roles_changed', data: { guildId: message } });
      } else if (channel === GUILD_SYNCED_CHANNEL) {
        this.changes.next({ type: 'guild_synced', data: { guildId: message } });
      } else if (channel === GUILD_MEMBERSHIP_EVENTS_CHANNEL) {
        this.changes.next({ type: 'guilds_changed', data: { guildId: message } });
      }
    };
    await Promise.all([
      this.redis.subscribe(GUILD_MEMBERSHIP_EVENTS_CHANNEL, dispatch),
      this.redis.subscribe(GUILD_CHANNELS_CHANGED_CHANNEL, dispatch),
      this.redis.subscribe(GUILD_SETTINGS_CHANGED_CHANNEL, dispatch),
      this.redis.subscribe(GUILD_ROLES_CHANGED_CHANNEL, dispatch),
      this.redis.subscribe(GUILD_SYNCED_CHANNEL, dispatch),
    ]);
  }

  stream(): Observable<MessageEvent> {
    const keepAlive = interval(25_000).pipe(map(() => ({ type: 'keepalive', data: {} })));
    return merge(this.changes.asObservable(), keepAlive);
  }
}
