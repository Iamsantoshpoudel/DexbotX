import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { auditLogs, GuildRow, guildSettings } from '../db/schema';
import { ChannelAccessService } from '../discord/channel-access.service';
import { DiscordApiError, DiscordRestService } from '../discord/discord-rest.service';
import { GuildsService } from '../guilds/guilds.service';
import { AssetFetcher } from '../render/asset-fetcher.service';
import { MessageBuilder } from '../render/message-builder.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { AssetStorage } from '../storage/asset-storage.service';
import type { SessionData } from '../common/types';
import { guildBannerUrl, userAvatarUrl } from '../shared/discord-cdn';
import { defaultMessageConfig, MessageConfig, MessageKind } from '../shared/message-config';
import type { PlaceholderContext } from '../shared/placeholders';
import { createCardKey, RENDER_VERSION } from '../shared/card-key';
import { RedisService } from '../redis/redis.service';

export { RENDER_VERSION };

const CARD_CACHE_TTL_SECONDS = 24 * 60 * 60;
const MAX_CACHED_CARD_BYTES = 1024 * 1024;

@Injectable()
export class WelcomeService {
  private readonly logger = new Logger(WelcomeService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly cache: SettingsCache,
    private readonly guilds: GuildsService,
    private readonly discord: DiscordRestService,
    private readonly channelAccess: ChannelAccessService,
    private readonly builder: MessageBuilder,
    private readonly assets: AssetFetcher,
    private readonly storage: AssetStorage,
    private readonly redis: RedisService,
  ) {}

  private sampleContext(guild: GuildRow, session: SessionData): PlaceholderContext {
    return {
      userId: session.userId,
      username: session.username,
      displayName: session.globalName ?? session.username,
      serverName: guild.name,
      memberCount: Math.max(guild.memberCount, 1),
    };
  }

  private async sampleAssets(guild: GuildRow, session: SessionData, config: MessageConfig) {
    const wantsImage = config.image.enabled;
    const useCustomBackground = wantsImage && !!config.image.backgroundPath;
    const useServerBanner = wantsImage && config.image.useServerBanner;
    const avatarUrl = userAvatarUrl(session.userId, session.avatarHash, 256);
    if (useCustomBackground) {
      const [avatar, background] = await Promise.all([
        this.assets.fetch(avatarUrl),
        this.storage.get(config.image.backgroundPath),
      ]);
      const banner = useServerBanner && !background
        ? await this.assets.fetch(guildBannerUrl(guild.id, guild.bannerHash, 1024))
        : null;
      return { avatar, banner, background };
    }

    const [avatar, banner] = await Promise.all([
      wantsImage ? this.assets.fetch(avatarUrl) : null,
      useServerBanner ? this.assets.fetch(guildBannerUrl(guild.id, guild.bannerHash, 1024)) : null,
    ]);
    return { avatar, banner, background: null };
  }

  /** A background may only reference an object uploaded for THIS server. */
  private assertBackgroundOwnership(guild: GuildRow, config: MessageConfig): void {
    const path = config.image.backgroundPath;
    if (path && !path.startsWith(`${guild.id}/`)) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ path: 'image.backgroundPath', message: 'That background does not belong to this server' }],
      });
    }
  }

  async save(guild: GuildRow, session: SessionData, kind: MessageKind, config: MessageConfig): Promise<{ config: MessageConfig; imageKey: string | null }> {
    if (config.enabled && !config.channelId) {
      throw new BadRequestException({ message: 'Validation failed', issues: [{ path: 'channelId', message: 'Choose a channel to post in' }] });
    }
    if (config.channelId) {
      const channels = await this.guilds.getChannels(guild.id);
      if (!channels.some((c) => c.id === config.channelId)) {
        throw new BadRequestException({
          message: 'Validation failed',
          issues: [{ path: 'channelId', message: 'That channel does not exist in this server' }],
        });
      }
    }

    this.assertBackgroundOwnership(guild, config);
    const before = await this.cache.get(guild.id);
    const other = kind === 'welcome' ? 'goodbye' : 'welcome';
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      await tx
        .insert(guildSettings)
        .values({
          guildId: guild.id,
          [kind]: config,
          [other]: defaultMessageConfig(other),
          updatedBy: session.userId,
          updatedAt: now,
        } as typeof guildSettings.$inferInsert)
        .onConflictDoUpdate({
          target: guildSettings.guildId,
          set: { [kind]: config, updatedBy: session.userId, updatedAt: now },
        });
      await tx.insert(auditLogs).values({ guildId: guild.id, userId: session.userId, action: `${kind}.update` });
    });
    await this.cache.invalidate(guild.id);

    await this.removeReplacedBackground(before, kind, config);
    return { config, imageKey: config.image.enabled ? createCardKey(config.image, session.avatarHash, guild.bannerHash) : null };
  }

  async reset(guild: GuildRow, session: SessionData, kind: MessageKind): Promise<{ config: MessageConfig; imageKey: string | null }> {
    const before = await this.cache.get(guild.id);
    const other = kind === 'welcome' ? 'goodbye' : 'welcome';
    const config = defaultMessageConfig(kind);
    const now = new Date();

    await this.database.db.transaction(async (tx) => {
      await tx
        .insert(guildSettings)
        .values({
          guildId: guild.id,
          [kind]: config,
          [other]: before[other],
          updatedBy: session.userId,
          updatedAt: now,
        } as typeof guildSettings.$inferInsert)
        .onConflictDoUpdate({
          target: guildSettings.guildId,
          set: { [kind]: config, updatedBy: session.userId, updatedAt: now },
        });
      await tx.insert(auditLogs).values({ guildId: guild.id, userId: session.userId, action: `${kind}.reset` });
    });
    await this.cache.invalidate(guild.id);

    await this.removeReplacedBackground(before, kind, config);
    return { config, imageKey: config.image.enabled ? createCardKey(config.image, session.avatarHash, guild.bannerHash) : null };
  }

  private async removeReplacedBackground(
    before: Awaited<ReturnType<SettingsCache['get']>>,
    kind: MessageKind,
    config: MessageConfig,
  ): Promise<void> {
    const other = kind === 'welcome' ? 'goodbye' : 'welcome';
    const oldPath = before[kind].image.backgroundPath;
    if (oldPath && oldPath !== config.image.backgroundPath && oldPath !== before[other].image.backgroundPath) {
      await this.storage.remove(oldPath);
    }
  }

  imageKey(guild: GuildRow, session: SessionData, config: MessageConfig): string | null {
    return config.image.enabled ? createCardKey(config.image, session.avatarHash, guild.bannerHash) : null;
  }

  async preview(
    guild: GuildRow,
    session: SessionData,
    config: MessageConfig,
    ifNoneMatch?: string,
  ): Promise<{ buffer: Buffer; imageKey: string | null; notModified: boolean }> {
    this.assertBackgroundOwnership(guild, config);
    const imageKey = this.imageKey(guild, session, config);
    const etag = imageKey ? `"${imageKey}"` : null;
    const cacheKey = imageKey ? `card:${imageKey}` : null;
    if (cacheKey && etag) {
      try {
        const cached = await this.redis.client.getBuffer(cacheKey);
        if (cached) return { buffer: cached, imageKey, notModified: ifNoneMatch === etag };
      } catch (err) {
        this.logger.warn(`Card cache read failed: ${(err as Error).message}`);
      }
    }

    const buffer = await this.builder.buildImage(config, this.sampleContext(guild, session), await this.sampleAssets(guild, session, config));
    if (cacheKey && buffer.length <= MAX_CACHED_CARD_BYTES) {
      this.redis.client.set(cacheKey, buffer, 'EX', CARD_CACHE_TTL_SECONDS)
        .catch((err) => this.logger.warn(`Card cache write failed: ${err.message}`));
    }
    return { buffer, imageKey, notModified: false };
  }

  async sendTest(guild: GuildRow, session: SessionData, kind: MessageKind): Promise<{ channelId: string }> {
    const config = (await this.cache.get(guild.id))[kind];
    if (!config.channelId) throw new BadRequestException('Choose a channel and save before sending a test');
    const channels = await this.guilds.getChannels(guild.id);
    const channel = channels.find((c) => c.id === config.channelId);
    if (!channel) throw new BadRequestException('The saved channel no longer exists. Pick another one and save.');

    const message = await this.builder.build(config, this.sampleContext(guild, session), await this.sampleAssets(guild, session, config));
    try {
      await this.discord.createMessage(channel.id, message, [session.userId]);
    } catch (err) {
      if (err instanceof DiscordApiError && err.status === 403) {
        const result = await this.channelAccess.ensureChannelAccess(guild.id, channel.id);
        if (result === 'fixed') {
          try {
            await this.discord.createMessage(channel.id, message, [session.userId]);
            return { channelId: channel.id };
          } catch (retryError) {
            if (retryError instanceof DiscordApiError && (retryError.status === 403 || retryError.status === 404)) {
              throw new BadRequestException(
                `DexBotX cannot post in #${channel.name}. Give the bot View Channel, Send Messages, Embed Links and Attach Files there.`,
              );
            }
            throw retryError;
          }
        }
        if (result === 'no-manage-roles') {
          throw new BadRequestException(
            `DexBotX can't post in #${channel.name}. Give it the Manage Roles permission, or allow View Channel, Send Messages, Embed Links and Attach Files for the bot in that channel.`,
          );
        }
      }
      if (err instanceof DiscordApiError && (err.status === 403 || err.status === 404)) {
        throw new BadRequestException(
          `DexBotX cannot post in #${channel.name}. Give the bot View Channel, Send Messages, Embed Links and Attach Files there.`,
        );
      }
      throw err;
    }
    return { channelId: channel.id };
  }
}
