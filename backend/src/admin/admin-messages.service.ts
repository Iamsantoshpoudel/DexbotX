import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { APIEmbed } from 'discord.js';
import { DatabaseService } from '../db/database.service';
import { guilds } from '../db/schema';
import { DiscordApiError, DiscordChannel, DiscordRestService } from '../discord/discord-rest.service';
import type { BuiltMessage } from '../render/message-builder.service';
import { RedisService } from '../redis/redis.service';
import { AdminAuditService } from './admin-audit.service';

const SYSTEM_CHANNEL_CACHE_PREFIX = 'discord:cache:system-channel:';
const SYSTEM_CHANNEL_TTL_SECONDS = 15 * 60;
const MAX_GUILD_MESSAGES_PER_HOUR = 3;
const PREFERRED_CHANNEL_NAMES = new Set(['general', 'chat', 'main', 'lounge', 'welcome', 'lobby']);

export interface AdminMessageEmbedInput {
  title?: string;
  description?: string;
  color?: string | number;
}

export interface AdminMessageInput {
  channelId?: string;
  content: string;
  embed?: AdminMessageEmbedInput;
}

@Injectable()
export class AdminMessagesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly discord: DiscordRestService,
    private readonly audit: AdminAuditService,
  ) {}

  async channelsForMessage(guildId: string): Promise<{
    channels: Array<{ id: string; name: string; isDefault: boolean }>;
    defaultChannelId: string | null;
  }> {
    this.validateGuildId(guildId);
    const rawChannels = await this.discord.getGuildChannels(guildId);
    const channels = rawChannels
      .filter(isTextChannel)
      .sort((a, b) => a.position - b.position);
    const defaultChannelId = await this.pickDefaultChannel(guildId, channels);
    return {
      channels: channels.map(({ id, name }) => ({ id, name, isDefault: id === defaultChannelId })),
      defaultChannelId,
    };
  }

  async sendMessage(adminId: string, guildId: string, input: unknown): Promise<{ ok: true; channelId: string }> {
    const content = isRecord(input) && typeof input.content === 'string' ? input.content : '';
    const requestedChannelId = isRecord(input) && typeof input.channelId === 'string' ? input.channelId : undefined;
    let channelId = requestedChannelId ?? null;
    let channelName: string | null = null;
    let audited = false;

    try {
      this.validateGuildId(guildId);
      const body = validateMessageInput(input);
      const channels = await this.discord.getGuildChannels(guildId);
      const textChannels = channels.filter(isTextChannel).sort((a, b) => a.position - b.position);
      const defaultChannelId = await this.pickDefaultChannel(guildId, textChannels);
      channelId = body.channelId ?? defaultChannelId;
      if (!channelId) throw new BadRequestException('This server has no text channel available for messages.');
      const channel = textChannels.find((candidate) => candidate.id === channelId);
      if (!channel) throw new BadRequestException('That channel does not exist in this server.');
      channelName = channel.name;

      const guildRows = await this.database.db
        .select({ name: guilds.name })
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);
      if (!guildRows[0]) throw new NotFoundException('Server not found.');

      await this.enforceGuildHourlyLimit(guildId);
      const message: BuiltMessage = {
        content: body.content,
        embeds: body.embed ? [buildEmbed(body.embed)] : [],
      };
      await this.discord.createMessage(channelId, message);
      await this.auditMessageAttempt(adminId, guildId, channelId, body.content, {
        success: true,
        channelName,
      });
      audited = true;
      return { ok: true, channelId };
    } catch (error) {
      const transformed = error instanceof DiscordApiError && (error.status === 403 || error.status === 404)
        ? new UnprocessableEntityException({
          code: 'CANNOT_POST',
          message: `DexBotX cannot post in #${channelName ?? 'channel'}`,
        })
        : error;
      if (!audited) {
        await this.auditMessageAttempt(adminId, guildId, channelId, content, {
          success: false,
          channelName,
          failure: transformed instanceof HttpException ? transformed.getStatus() : 'error',
        });
      }
      throw transformed;
    }
  }

  private async pickDefaultChannel(guildId: string, channels: DiscordChannel[]): Promise<string | null> {
    let systemChannelId: string | null = null;
    const cacheKey = `${SYSTEM_CHANNEL_CACHE_PREFIX}${guildId}`;
    const cachedSystemChannelId = await this.redis.client.get(cacheKey);
    if (cachedSystemChannelId !== null) {
      const parsed: unknown = JSON.parse(cachedSystemChannelId);
      systemChannelId = typeof parsed === 'string' ? parsed : null;
    } else {
      try {
        const guild = await this.discord.getGuildAsBot(guildId);
        systemChannelId = guild.system_channel_id ?? null;
        await this.redis.client.set(
          cacheKey,
          JSON.stringify(systemChannelId),
          'EX',
          SYSTEM_CHANNEL_TTL_SECONDS,
        );
      } catch (error) {
        if (!(error instanceof DiscordApiError) || (error.status !== 403 && error.status !== 404)) throw error;
      }
    }

    if (systemChannelId && channels.some((channel) => channel.id === systemChannelId)) return systemChannelId;
    return channels.find((channel) => PREFERRED_CHANNEL_NAMES.has(channel.name.toLowerCase()))?.id
      ?? channels[0]?.id
      ?? null;
  }

  private async enforceGuildHourlyLimit(guildId: string): Promise<void> {
    const key = `rl:admin-message:guild:${guildId}`;
    const result = await this.redis.client.multi().incr(key).ttl(key).exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    let ttl = Number(result?.[1]?.[1] ?? -1);
    if (ttl < 0) {
      ttl = 60 * 60;
      await this.redis.client.expire(key, ttl);
    }
    if (count > MAX_GUILD_MESSAGES_PER_HOUR) {
      throw new HttpException({
        statusCode: 429,
        message: 'This server has reached the message limit. Try again later.',
        retryAfter: Math.max(1, ttl),
      }, 429);
    }
  }

  private auditMessageAttempt(
    adminId: string,
    guildId: string,
    channelId: string | null,
    content: string,
    result: { success: boolean; channelName: string | null; failure?: number | string },
  ): Promise<void> {
    return this.audit.log(adminId, 'guild.message', guildId, {
      guildId,
      channelId,
      channelName: result.channelName,
      success: result.success,
      failure: result.failure,
      length: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
      preview: content.slice(0, 100),
    });
  }

  private validateGuildId(guildId: string): void {
    if (!/^\d{17,20}$/.test(guildId)) throw new BadRequestException('Invalid server ID.');
  }
}

function isTextChannel(channel: DiscordChannel): boolean {
  return channel.type === 0 || channel.type === 5;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMessageInput(input: unknown): AdminMessageInput {
  if (!isRecord(input)) throw new BadRequestException('A message body is required.');
  if (typeof input.content !== 'string' || input.content.length < 1 || input.content.length > 2000) {
    throw new BadRequestException('Message content must be between 1 and 2000 characters.');
  }
  if (input.channelId !== undefined && (typeof input.channelId !== 'string' || !/^\d{17,20}$/.test(input.channelId))) {
    throw new BadRequestException('Invalid channel ID.');
  }
  if (input.embed !== undefined && !isRecord(input.embed)) throw new BadRequestException('Embed must be an object.');

  let embed: AdminMessageEmbedInput | undefined;
  if (input.embed !== undefined) {
    const raw = input.embed as Record<string, unknown>;
    for (const key of ['title', 'description'] as const) {
      if (raw[key] !== undefined && typeof raw[key] !== 'string') {
        throw new BadRequestException(`Embed ${key} must be text.`);
      }
    }
    if (typeof raw.title === 'string' && raw.title.length > 256) {
      throw new BadRequestException('Embed title must be at most 256 characters.');
    }
    if (typeof raw.description === 'string' && raw.description.length > 4000) {
      throw new BadRequestException('Embed description must be at most 4000 characters.');
    }
    if (raw.color !== undefined && !isValidEmbedColor(raw.color)) {
      throw new BadRequestException('Embed color must be a six-digit hex color or an integer from 0 to 16777215.');
    }
    embed = {
      ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
      ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
      ...(typeof raw.color === 'string' || typeof raw.color === 'number' ? { color: raw.color } : {}),
    };
  }

  return {
    content: input.content,
    ...(typeof input.channelId === 'string' ? { channelId: input.channelId } : {}),
    ...(embed ? { embed } : {}),
  };
}

function isValidEmbedColor(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
  return typeof value === 'string' && /^#?[0-9a-fA-F]{6}$/.test(value);
}

function buildEmbed(input: AdminMessageEmbedInput): APIEmbed {
  const embed: APIEmbed = {};
  if (input.title) embed.title = input.title;
  if (input.description) embed.description = input.description;
  if (input.color !== undefined) {
    embed.color = typeof input.color === 'number'
      ? input.color
      : Number.parseInt(input.color.replace(/^#/, ''), 16);
  }
  return embed;
}
