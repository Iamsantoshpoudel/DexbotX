import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  ActivityType,
  AuditLogEvent,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Guild,
  GuildMember,
  type ChatInputCommandInteraction,
  Options,
  PartialGuildMember,
  PermissionFlagsBits,
  Partials,
  type GuildBasedChannel,
} from 'discord.js';
import { APP_CONFIG, AppConfig } from '../core/config';
import { RateLimiter } from '../redis/rate-limiter.service';
import { RedisService } from '../redis/redis.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { MemberEventsQueue } from '../queue/member-events.queue';
import type { MessageKind } from '../shared/message-config';
import { GuildSyncService } from './guild-sync.service';
import { StatsService } from '../admin/stats.service';
import { FeatureFlagsService } from '../core/feature-flags.service';
import { OnboardingService } from '../discord/onboarding.service';
import { ModerationService } from './moderation.service';

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  readonly client: Client;
  private syncTimer?: ReturnType<typeof setInterval>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnects = 0;
  private shardStatus = 'connecting';

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SettingsCache,
    private readonly queue: MemberEventsQueue,
    private readonly limiter: RateLimiter,
    private readonly sync: GuildSyncService,
    private readonly stats: StatsService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly onboarding: OnboardingService,
    private readonly redis: RedisService,
    private readonly moderation: ModerationService,
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
    c.on(Events.GuildCreate, (g) => this.safe('guildCreate', () => this.onGuildCreate(g)));
    c.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand() || !interaction.guild) return;
      void this.handleModerationInteraction(interaction);
    });
    c.on(Events.GuildUpdate, (_old, g) => this.safe('guildUpdate', () => this.sync.guildUpdated(g)));
    c.on(Events.GuildDelete, (g) => {
      if (g.available === false) return; // outage, not a kick
      return this.safe('guildDelete', () => this.sync.markLeft(g.id));
    });
    c.on(Events.ChannelCreate, (channel) => {
      if (channel.isDMBased()) return;
      return this.safe('channelCreate', () => this.sync.upsertChannel(channel.guildId, {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: 'position' in channel ? channel.position : 0,
        parent_id: channel.parentId,
      }));
    });
    c.on(Events.ChannelUpdate, (_old, channel) => {
      if (channel.isDMBased()) return;
      return this.safe('channelUpdate', () => this.sync.upsertChannel(channel.guildId, {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: 'position' in channel ? channel.position : 0,
        parent_id: channel.parentId,
      }));
    });
    c.on(Events.ChannelDelete, (channel) => {
      if (channel.isDMBased()) return;
      return this.safe('channelDelete', () => this.sync.deleteChannel(channel.guildId, channel.id));
    });
    c.on(Events.GuildRoleCreate, (role) => this.safe('roleCreate', () => this.sync.upsertRole(role.guild.id, role)));
    c.on(Events.GuildRoleUpdate, (_old, role) => this.safe('roleUpdate', () => this.sync.upsertRole(role.guild.id, role)));
    c.on(Events.GuildRoleDelete, (role) => this.safe('roleDelete', () => this.sync.deleteRole(role.guild.id, role.id)));
    c.on(Events.GuildMemberAdd, (m) => this.safe('welcome', () => this.handleMember('welcome', m)));
    c.on(Events.GuildMemberRemove, (m) => this.safe('goodbye', () => this.handleMember('goodbye', m)));
    c.on(Events.Error, (err) => this.logger.error(`Client error: ${err.message}`));
    c.on(Events.ShardError, (err, id) => this.logger.error(`Shard ${id} error: ${err.message}`));
    c.on(Events.ShardDisconnect, (_e, id) => this.logger.warn(`Shard ${id} disconnected`));
    c.on(Events.ShardReconnecting, (id) => {
      this.reconnects++;
      this.shardStatus = 'reconnecting';
      this.logger.warn(`Shard ${id} reconnecting`);
    });
    c.on(Events.ShardResume, (id) => {
      this.shardStatus = 'online';
      this.logger.log(`Shard ${id} resumed`);
    });

    await c.login(this.config.discordBotToken);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    await this.client.destroy();
  }

  private async safe(name: string, fn: () => Promise<unknown> | unknown): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${name} handler failed: ${(err as Error).stack ?? err}`);
    }
  }

  private async handleModerationInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await this.moderation.handle(interaction);
    } catch {
      this.logger.error(`Moderation interaction failed in guild ${interaction.guildId}`);
      await this.moderation.recordUnexpectedFailure(interaction.commandName);
      try {
        const reply = {
          content: 'Something went wrong while processing that moderation command.',
          allowedMentions: { parse: [] as const },
        };
        if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
        else await interaction.reply({ ...reply, ephemeral: true });
      } catch {
        this.logger.warn(`Could not send moderation error response in guild ${interaction.guildId}`);
      }
    }
  }

  private async onReady(ready: Client<true>): Promise<void> {
    this.shardStatus = 'online';
    this.logger.log(`Ready as ${ready.user.tag} with ${ready.guilds.cache.size} guild(s) on this shard`);
    ready.user.setPresence({
      activities: [{ name: 'custom', state: 'dexbotx.vercel.app', type: ActivityType.Custom }],
      status: 'online',
    });
    await this.writeHeartbeat();
    this.heartbeatTimer = setInterval(() => void this.writeHeartbeat(), 15_000);
    this.heartbeatTimer.unref();
    await this.syncAll([...ready.guilds.cache.values()]);
    this.syncTimer = setInterval(() => {
      void this.syncAll([...ready.guilds.cache.values()]);
    }, 3 * 60 * 60 * 1000);
  }

  private writeHeartbeat(): Promise<void> {
    const shardId = this.client.shard?.ids[0] ?? 0;
    return this.stats.heartbeat(`shard:${shardId}`, {
      status: this.shardStatus,
      pingMs: this.client.ws.ping,
      guilds: this.client.guilds.cache.size,
      reconnects: this.reconnects,
      at: new Date().toISOString(),
    });
  }

  private async syncAll(guilds: Guild[]): Promise<void> {
    for (const guild of guilds) {
      await this.safe(`sync ${guild.id}`, () => this.sync.syncGuild(guild.id));
    }
    await this.safe('publish guild reconciliation', () => this.sync.notifyReconciled());
  }

  private async handleMember(kind: MessageKind, member: GuildMember | PartialGuildMember): Promise<void> {
    if (member.user.bot) return;
    const flags = await this.featureFlags.get();
    if (flags.maintenance) return;
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
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return;
    }

    const allowed = await this.limiter.hit(`post:${guild.id}:${kind}`, flags.messageRatePerMinute, 60);
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

  async onGuildCreate(guild: Guild): Promise<void> {
    const inserted = await this.sync.upsert(guild);
    await this.sync.syncGuild(guild.id);
    if (!this.client.isReady()) return;

    const joinedAt = guild.joinedTimestamp;
    const joinedRecently = joinedAt !== null && joinedAt <= Date.now() && Date.now() - joinedAt <= 2 * 60 * 1000;
    if (!inserted && !joinedRecently) return;

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const inviterId = await this.findInviter(guild);
    let channelId: string | undefined;
    try {
      const me = guild.members.me ?? await guild.members.fetchMe();
      channelId = findOnboardingChannel(guild, me)?.id;
    } catch {
      channelId = undefined;
    }
    await this.onboarding.sendOnce(
      guild.id,
      guild.name,
      channelId,
      inviterId,
      inviterId ?? guild.ownerId,
    );
  }

  private async findInviter(guild: Guild): Promise<string | undefined> {
    const cached = await this.redis.client.get(`inviter:${guild.id}`);
    if (cached) return cached;
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
      const botId = this.client.user?.id;
      return logs.entries.find((entry) => entry.target?.id === botId)?.executor?.id;
    } catch {
      return undefined;
    }
  }
}

export function findOnboardingChannel(guild: Guild, me: GuildMember): GuildBasedChannel | undefined {
  const isUsable = (channel: GuildBasedChannel): boolean => {
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) return false;
    const everyonePermissions = channel.permissionsFor(guild.roles.everyone);
    if (!everyonePermissions?.has(PermissionFlagsBits.ViewChannel)) return false;
    const botPermissions = channel.permissionsFor(me);
    return Boolean(botPermissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ]));
  };

  if (guild.systemChannel && isUsable(guild.systemChannel)) return guild.systemChannel;

  const channels = [...guild.channels.cache.values()].filter(isUsable);
  const preferredNames = ['general', 'chat', 'main', 'lounge', 'welcome', 'lobby'];
  const named = channels
    .filter((channel) => preferredNames.includes(channel.name.toLowerCase()))
    .sort((a, b) =>
      preferredNames.indexOf(a.name.toLowerCase()) - preferredNames.indexOf(b.name.toLowerCase()) ||
      channelPosition(a) - channelPosition(b),
    );
  return named[0] ?? channels.sort((a, b) => channelPosition(a) - channelPosition(b))[0];
}

function channelPosition(channel: GuildBasedChannel): number {
  return 'position' in channel && typeof channel.position === 'number' ? channel.position : 0;
}
