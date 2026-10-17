import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  ActivityType,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  GuildMember,
  Options,
  PartialGuildMember,
  PermissionFlagsBits,
  Partials,
} from 'discord.js';
import { APP_CONFIG, AppConfig } from '../core/config';
import { RateLimiter } from '../redis/rate-limiter.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { MemberEventsQueue } from '../queue/member-events.queue';
import type { MessageKind } from '../shared/message-config';
import { GuildSyncService } from './guild-sync.service';

/** Max welcome/goodbye posts per server per minute. Protects against join raids and Discord rate limits. */
const MAX_POSTS_PER_MINUTE = 20;

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  readonly client: Client;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SettingsCache,
    private readonly queue: MemberEventsQueue,
    private readonly limiter: RateLimiter,
    private readonly sync: GuildSyncService,
  ) {
    this.client = new Client({
      // Server Members is a privileged intent: enable it in the Developer Portal (Bot > Privileged Gateway Intents).
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
      // Without this, goodbye events are dropped for members that are not cached.
      partials: [Partials.GuildMember],
      allowedMentions: { parse: [] },
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
        VoiceStateManager: 0,
        StageInstanceManager: 0,
        GuildMemberManager: { maxSize: 1, keepOverLimit: (m) => m.id === m.client.user?.id },
      }),
      rest: { timeout: 15_000 },
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    const c = this.client;
    c.once(Events.ClientReady, (ready) => this.onReady(ready));
    c.on(Events.GuildCreate, (g) => this.safe('guildCreate', () => this.sync.upsert(g)));
    c.on(Events.GuildUpdate, (_old, g) => this.safe('guildUpdate', () => this.sync.upsert(g)));
    c.on(Events.GuildDelete, (g) => {
      if (g.available === false) return; // outage, not a kick
      return this.safe('guildDelete', () => this.sync.markLeft(g.id));
    });
    c.on(Events.GuildMemberAdd, (m) => this.safe('welcome', () => this.handleMember('welcome', m)));
    c.on(Events.GuildMemberRemove, (m) => this.safe('goodbye', () => this.handleMember('goodbye', m)));
    c.on(Events.Error, (err) => this.logger.error(`Client error: ${err.message}`));
    c.on(Events.ShardError, (err, id) => this.logger.error(`Shard ${id} error: ${err.message}`));
    c.on(Events.ShardDisconnect, (_e, id) => this.logger.warn(`Shard ${id} disconnected`));
    c.on(Events.ShardReconnecting, (id) => this.logger.warn(`Shard ${id} reconnecting`));

    await c.login(this.config.discordBotToken);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.destroy();
  }

  private async safe(name: string, fn: () => Promise<unknown> | unknown): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${name} handler failed: ${(err as Error).stack ?? err}`);
    }
  }

  private async onReady(ready: Client<true>): Promise<void> {
    this.logger.log(`Ready as ${ready.user.tag} with ${ready.guilds.cache.size} guild(s) on this shard`);
    ready.user.setPresence({ activities: [{ name: 'new members arrive', type: ActivityType.Watching }], status: 'online' });
    await this.safe('initial sync', () => this.sync.upsertMany([...ready.guilds.cache.values()]));
  }

  private async handleMember(kind: MessageKind, member: GuildMember | PartialGuildMember): Promise<void> {
    if (member.user.bot) return;
    const guild = member.guild;

    const config = (await this.settings.get(guild.id))[kind];
    if (!config.enabled || !config.channelId) return;

    // Only post to channels that belong to THIS server, whatever the stored id says.
    const channel = guild.channels.cache.get(config.channelId);
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
      this.logger.debug(`Channel ${config.channelId} missing in ${guild.id}`);
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe());
    const perms = channel.permissionsFor(me);
    const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
    if (config.embed.enabled) needed.push(PermissionFlagsBits.EmbedLinks);
    if (config.image.enabled) needed.push(PermissionFlagsBits.AttachFiles);
    if (!perms || !perms.has(needed)) {
      this.logger.debug(`Missing permissions in #${channel.name} (${guild.id})`);
      return;
    }

    const allowed = await this.limiter.hit(`post:${guild.id}:${kind}`, MAX_POSTS_PER_MINUTE, 60);
    if (!allowed.allowed) {
      this.logger.warn(`Rate limit reached for ${kind} in ${guild.id}; skipping`);
      return;
    }

    // Rendering and posting happen in the worker process; the shard only validates and hands off.
    const user = member.user;
    await this.queue.enqueue({
      kind,
      guildId: guild.id,
      channelId: channel.id,
      user: {
        id: user.id,
        username: user.username,
        displayName: member.displayName ?? user.globalName ?? user.username,
        avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
      },
      guild: {
        name: guild.name,
        memberCount: guild.memberCount,
        bannerUrl: config.image.enabled && config.image.useServerBanner ? guild.bannerURL({ extension: 'png', size: 1024, forceStatic: true }) : null,
      },
    });
  }
}
