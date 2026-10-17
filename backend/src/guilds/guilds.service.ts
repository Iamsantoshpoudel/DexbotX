import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { SessionService } from '../auth/session.service';
import type { SessionData } from '../common/types';
import { APP_CONFIG, AppConfig } from '../core/config';
import { DatabaseService } from '../db/database.service';
import { GuildRow, guilds } from '../db/schema';
import { DiscordApiError, DiscordRestService, DiscordUserGuild } from '../discord/discord-rest.service';
import { RedisService } from '../redis/redis.service';
import { guildBannerUrl, guildIconUrl } from '../shared/discord-cdn';
import { canManageGuild } from '../shared/permissions';

const USER_GUILDS_TTL = 60;
const CHANNELS_TTL = 60;

export interface GuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  botInstalled: boolean;
  inviteUrl: string | null;
}

export interface ChannelInfo {
  id: string;
  name: string;
  category: string | null;
}

@Injectable()
export class GuildsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly discord: DiscordRestService,
    private readonly sessions: SessionService,
  ) {}

  /** Bot invite link. With a guild id the server is preselected; without one Discord lets the user choose. */
  inviteUrl(guildId?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.discordClientId,
      scope: 'bot',
      permissions: this.config.botPermissions,
    });
    if (guildId) {
      params.set('guild_id', guildId);
      params.set('disable_guild_select', 'true');
    }
    return `https://discord.com/oauth2/authorize?${params}`;
  }

  /** The user's servers from Discord, cached for a minute (Discord rate limits this endpoint). */
  async getUserGuilds(session: SessionData, sid?: string): Promise<DiscordUserGuild[]> {
    const key = `ug:${session.userId}`;
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached) as DiscordUserGuild[];
    try {
      const list = await this.discord.getCurrentUserGuilds(this.sessions.accessToken(session));
      await this.redis.client.set(key, JSON.stringify(list), 'EX', USER_GUILDS_TTL);
      return list;
    } catch (err) {
      if (err instanceof DiscordApiError && err.status === 401) {
        if (sid) await this.sessions.destroy(sid);
        throw new UnauthorizedException('Your Discord session expired. Log in again.');
      }
      throw err;
    }
  }

  async listForUser(session: SessionData, sid?: string): Promise<GuildSummary[]> {
    const manageable = (await this.getUserGuilds(session, sid)).filter(canManageGuild);
    if (manageable.length === 0) return [];
    const rows = await this.database.db
      .select({ id: guilds.id })
      .from(guilds)
      .where(and(inArray(guilds.id, manageable.map((g) => g.id)), eq(guilds.installed, true)));
    const installed = new Set(rows.map((r) => r.id));
    return manageable
      .map<GuildSummary>((g) => ({
        id: g.id,
        name: g.name,
        iconUrl: guildIconUrl(g.id, g.icon),
        owner: g.owner,
        botInstalled: installed.has(g.id),
        inviteUrl: installed.has(g.id) ? null : this.inviteUrl(g.id),
      }))
      .sort((a, b) => Number(b.botInstalled) - Number(a.botInstalled) || a.name.localeCompare(b.name));
  }

  async findInstalled(guildId: string): Promise<GuildRow | null> {
    const rows = await this.database.db
      .select()
      .from(guilds)
      .where(and(eq(guilds.id, guildId), eq(guilds.installed, true)))
      .limit(1);
    return rows[0] ?? null;
  }

  toDetail(row: GuildRow) {
    return {
      id: row.id,
      name: row.name,
      iconUrl: guildIconUrl(row.id, row.iconHash),
      bannerUrl: guildBannerUrl(row.id, row.bannerHash, 600),
      memberCount: row.memberCount,
    };
  }

  /** Text and announcement channels, fetched with the bot token and cached briefly. */
  async getChannels(guildId: string): Promise<ChannelInfo[]> {
    const key = `chan:${guildId}`;
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached) as ChannelInfo[];
    try {
      const all = await this.discord.getGuildChannels(guildId);
      const categories = new Map(all.filter((c) => c.type === 4).map((c) => [c.id, c.name]));
      const list = all
        .filter((c) => c.type === 0 || c.type === 5)
        .sort((a, b) => a.position - b.position)
        .map<ChannelInfo>((c) => ({ id: c.id, name: c.name, category: c.parent_id ? (categories.get(c.parent_id) ?? null) : null }));
      await this.redis.client.set(key, JSON.stringify(list), 'EX', CHANNELS_TTL);
      return list;
    } catch (err) {
      if (err instanceof DiscordApiError && (err.status === 403 || err.status === 404)) {
        throw new NotFoundException('DexBotX cannot see this server. Re-add the bot, then try again.');
      }
      throw err;
    }
  }
}
