import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../core/config';
import type { BuiltMessage } from '../render/message-builder.service';

const API = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://dexbotx.app, 1.0.0)';

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
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  banner?: string | null;
  approximate_member_count?: number;
  owner_id?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

@Injectable()
export class DiscordRestService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let body: any = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const retryAfter = res.status === 429 ? Number(body?.retry_after ?? res.headers.get('retry-after') ?? 1) : undefined;
      throw new DiscordApiError(res.status, body?.code, body?.message ?? `Discord API error ${res.status}`, retryAfter);
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

  getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>(`/guilds/${guildId}/channels`, { headers: this.bot() });
  }

  getGuildRoles(guildId: string): Promise<DiscordRole[]> {
    return this.request<DiscordRole[]>(`/guilds/${guildId}/roles`, { headers: this.bot() });
  }

  /** Succeeds only if the bot is in the guild; Discord returns 404/403 otherwise. */
  getGuildAsBot(guildId: string): Promise<DiscordGuild> {
    return this.request<DiscordGuild>(`/guilds/${guildId}?with_counts=true`, { headers: this.bot() });
  }

  async createMessage(channelId: string, message: BuiltMessage, mentionUserIds: string[]): Promise<void> {
    const payload = {
      content: message.content,
      embeds: message.embeds,
      allowed_mentions: { parse: [], users: mentionUserIds },
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
