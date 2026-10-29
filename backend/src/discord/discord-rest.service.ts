import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../core/config';
import type { BuiltMessage } from '../render/message-builder.service';
import { StatsService } from '../admin/stats.service';
import { RedisService } from '../redis/redis.service';

const API = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://dexbotx.app, 1.0.0)';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeRoute(path: string): string {
  return path.split('?')[0].replace(/\/\d{17,20}(?=\/|$)/g, '/:id');
}

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly discordCode: number | undefined,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'DiscordApiError';
  }
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordChannel {
  id: string;
  type: number;
  name: string;
  position: number;
  parent_id: string | null;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
  guild_id?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  banner?: string | null;
  approximate_member_count?: number;
  owner_id?: string;
  system_channel_id?: string | null;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  hoist?: boolean;
}

@Injectable()
export class DiscordRestService {
  private readonly logger = new Logger(DiscordRestService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly stats: StatsService,
    private readonly redis: RedisService,
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    await this.stats.recordDiscordRestCall((init.method ?? 'GET').toUpperCase(), normalizeRoute(path));
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(10_000),
    });
    await this.stats.incr('d_total');
    if ([401, 403, 404, 429].includes(res.status)) {
      await this.stats.incr(`d_${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const errorBody = isRecord(body) ? body : undefined;
      const retryAfterValue = errorBody?.retry_after;
      const retryAfterValueFromResponse = typeof retryAfterValue === 'number' || typeof retryAfterValue === 'string'
        ? Number(retryAfterValue)
        : Number(res.headers.get('retry-after') ?? 1);
      const retryAfter = res.status === 429
        ? Number.isFinite(retryAfterValueFromResponse) && retryAfterValueFromResponse >= 0
          ? retryAfterValueFromResponse
          : 1
        : undefined;
      if (res.status === 429 && retryAfter !== undefined) {
        const route = path.split('?')[0].replace(/\/\d{17,20}(?=\/|$)/g, '/:id');
        const global = isRecord(body) && body.global === true;
        await this.stats.pushEvent('d429', {
          route,
          scope: res.headers.get('x-ratelimit-scope'),
          retryAfter,
          global,
          at: new Date().toISOString(),
        });
        try {
          await this.redis.client.set(
            'discord:blocked_until',
            String(Date.now() + Math.ceil(retryAfter * 1000)),
            'EX',
            Math.max(1, Math.ceil(retryAfter)),
          );
        } catch (error) {
          this.logger.warn(`Discord cooldown write failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const discordCode = typeof errorBody?.code === 'number' ? errorBody.code : undefined;
      const message = typeof errorBody?.message === 'string' ? errorBody.message : `Discord API error ${res.status}`;
      throw new DiscordApiError(res.status, discordCode, message, retryAfter);
    }
    return body as T;
  }

  private bot(): Record<string, string> {
    return { Authorization: `Bot ${this.config.discordBotToken}` };
  }

  // ---- OAuth2 (user) ----

  exchangeCode(code: string): Promise<DiscordTokenResponse> {
    return this.request<DiscordTokenResponse>('/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.discordClientId,
        client_secret: this.config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });
  }

  async revokeToken(token: string): Promise<void> {
    await this.request<void>('/oauth2/token/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.discordClientId,
        client_secret: this.config.discordClientSecret,
        token,
        token_type_hint: 'access_token',
      }),
    });
  }

  getCurrentUser(accessToken: string): Promise<DiscordUser> {
    return this.request<DiscordUser>('/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
  }

  /** The user's servers, following pagination (200 per page, capped at 1000). */
  async getCurrentUserGuilds(accessToken: string): Promise<DiscordUserGuild[]> {
    const all: DiscordUserGuild[] = [];
    let after: string | undefined;
    for (let page = 0; page < 5; page++) {
      const qs = new URLSearchParams({ limit: '200' });
      if (after) qs.set('after', after);
      const batch = await this.request<DiscordUserGuild[]>(`/users/@me/guilds?${qs}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      all.push(...batch);
      if (batch.length < 200) break;
      after = batch[batch.length - 1].id;
    }
    return all;
  }

  // ---- Bot REST ----

  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    const key = `discord:cache:channels:${guildId}`;
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached) as DiscordChannel[];

    const blockedUntil = Number(await this.redis.client.get('discord:blocked_until'));
    if (blockedUntil > Date.now()) {
      throw new DiscordApiError(
        429,
        undefined,
        'Discord is temporarily rate limited and no cached channels are available.',
        Math.ceil((blockedUntil - Date.now()) / 1000),
      );
    }

    const channels = await this.request<DiscordChannel[]>(`/guilds/${guildId}/channels`, { headers: this.bot() });
    try {
      await this.redis.client.set(key, JSON.stringify(channels), 'EX', 60 * 60);
    } catch (error) {
      this.logger.warn(`Discord channel cache write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return channels;
  }

  async canBotPost(channelId: string): Promise<boolean> {
    const channel = await this.request<DiscordChannel>(`/channels/${channelId}`, { headers: this.bot() });
    const overwrites = channel.permission_overwrites ?? [];
    const denies = overwrites.filter((overwrite) =>
      overwrite.id === this.config.discordClientId || (overwrite.type === 0 && overwrite.id === channel.guild_id),
    );
    const denied = denies.reduce((bits, overwrite) => bits | BigInt(overwrite.deny), 0n);
    const allowed = denies.reduce((bits, overwrite) => bits | BigInt(overwrite.allow), 0n);
    const required = (1n << 10n) | (1n << 11n);
    return (denied & required & ~allowed) === 0n;
  }

  async leaveGuild(guildId: string): Promise<void> {
    await this.request<void>(`/users/@me/guilds/${guildId}`, { method: 'DELETE', headers: this.bot() });
  }

  getGuildRoles(guildId: string): Promise<DiscordRole[]> {
    return this.request<DiscordRole[]>(`/guilds/${guildId}/roles`, { headers: this.bot() });
  }

  createRole(guildId: string, name: string, permissions: string): Promise<DiscordRole> {
    return this.request<DiscordRole>(`/guilds/${guildId}/roles`, {
      method: 'POST',
      headers: { ...this.bot(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, permissions, mentionable: false, hoist: true }),
    });
  }

  modifyRole(guildId: string, roleId: string, body: { hoist: boolean }): Promise<DiscordRole> {
    return this.request<DiscordRole>(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      headers: { ...this.bot(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  getGuildMember(guildId: string, userId: string): Promise<{ roles: string[] }> {
    return this.request<{ roles: string[] }>(`/guilds/${guildId}/members/${userId}`, { headers: this.bot() });
  }

  async addMemberRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.request<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'PUT',
      headers: this.bot(),
    });
  }

  async setChannelOverwrite(channelId: string, targetId: string, allow: string): Promise<void> {
    await this.request<void>(`/channels/${channelId}/permissions/${targetId}`, {
      method: 'PUT',
      headers: { ...this.bot(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 0, allow, deny: '0' }),
    });
  }

  /** Succeeds only if the bot is in the guild; Discord returns 404/403 otherwise. */
  getGuildAsBot(guildId: string): Promise<DiscordGuild> {
    return this.request<DiscordGuild>(`/guilds/${guildId}?with_counts=true`, { headers: this.bot() });
  }

  async createDmChannel(userId: string): Promise<{ id: string }> {
    return this.request<{ id: string }>('/users/@me/channels', {
      method: 'POST',
      headers: { ...this.bot(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: userId }),
    });
  }

  async createMessage(
    channelId: string,
    message: BuiltMessage,
    mentions: string[] | { users: string[] } = [],
  ): Promise<void> {
    const users = Array.isArray(mentions) ? mentions : mentions.users;
    const payload = {
      content: message.content,
      embeds: message.embeds,
      allowed_mentions: { parse: [], users },
      ...(message.file ? { attachments: [{ id: 0, filename: message.file.name }] } : {}),
    };
    if (!message.file) {
      await this.request<void>(`/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { ...this.bot(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return;
    }
    const form = new FormData();
    form.set('payload_json', JSON.stringify(payload));
    form.set('files[0]', new Blob([new Uint8Array(message.file.data)], { type: 'image/png' }), message.file.name);
    await this.request<void>(`/channels/${channelId}/messages`, { method: 'POST', headers: this.bot(), body: form });
  }
}
