import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../core/config';
import { StatsService } from '../admin/stats.service';
import { DiscordRestService } from '../discord/discord-rest.service';
import { RedisService } from '../redis/redis.service';
import { randomToken } from '../shared/crypto';
import { SessionService } from './session.service';

const STATE_TTL_SECONDS = 600;

/** Only same-site dashboard/admin paths are allowed as post-login destinations (prevents open redirects). */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/dashboard';
  if (!/^\/(?:dashboard|admin)(?:\/[A-Za-z0-9_-]+)*\/?$/.test(value)) return '/dashboard';
  return value;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly redis: RedisService,
    private readonly discord: DiscordRestService,
    private readonly sessions: SessionService,
    private readonly stats: StatsService,
  ) {}

  async startLogin(returnTo: unknown): Promise<{ url: string; state: string }> {
    const state = randomToken(24);
    await this.redis.client.set(`oauth:state:${state}`, safeReturnTo(returnTo), 'EX', STATE_TTL_SECONDS);
    const params = new URLSearchParams({
      client_id: this.config.discordClientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });
    return { url: `https://discord.com/oauth2/authorize?${params}`, state };
  }

  /** Verifies state (bound to the browser by cookie and single-use in Redis), then creates the session. */
  async finishLogin(
    code: string,
    state: string,
    cookieState: string | undefined,
  ): Promise<{ sid: string; ttlSeconds: number; returnTo: string }> {
    if (!cookieState || cookieState !== state) throw new UnauthorizedException('Login state mismatch');
    const key = `oauth:state:${state}`;
    const returnTo = await this.redis.client.get(key);
    if (!returnTo) throw new UnauthorizedException('Login expired');
    await this.redis.client.del(key);

    const token = await this.discord.exchangeCode(code);
    const scopes = token.scope.split(' ');
    if (!scopes.includes('identify') || !scopes.includes('guilds')) {
      throw new UnauthorizedException('Missing required Discord permissions');
    }
    const user = await this.discord.getCurrentUser(token.access_token);
    const { sid, ttlSeconds } = await this.sessions.create(user, token);
    await this.stats.addUnique('logins', user.id);
    await this.stats.pushEvent('recent_logins', {
      id: user.id,
      username: user.username,
      avatarHash: user.avatar,
      at: new Date().toISOString(),
    });
    return { sid, ttlSeconds, returnTo: safeReturnTo(returnTo) };
  }

  async logout(sid: string): Promise<void> {
    const session = await this.sessions.get(sid);
    await this.sessions.destroy(sid);
    if (session) {
      await this.redis.client.del(`ug:${session.userId}`);
      this.discord.revokeToken(this.sessions.accessToken(session)).catch(() => undefined);
    }
  }
}
