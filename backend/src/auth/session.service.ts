import { Inject, Injectable } from '@nestjs/common';
import type { SessionData } from '../common/types';
import { APP_CONFIG, AppConfig } from '../core/config';
import type { DiscordTokenResponse, DiscordUser } from '../discord/discord-rest.service';
import { RedisService } from '../redis/redis.service';
import { decrypt, encrypt, randomToken, sha256Hex } from '../shared/crypto';

/**
 * Server-side sessions in Redis. The browser only holds an opaque random id in an httpOnly cookie;
 * the Discord access token never leaves the server and is encrypted at rest. Redis keys use a hash of
 * the id, so a Redis dump cannot be replayed as a cookie.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly redis: RedisService,
  ) {}

  private key(sid: string): string {
    return `sess:${sha256Hex(sid)}`;
  }

  async create(user: DiscordUser, token: DiscordTokenResponse): Promise<{ sid: string; ttlSeconds: number }> {
    const ttlSeconds = Math.max(60, Math.min(this.config.sessionTtlSeconds, token.expires_in - 60));
    const now = Date.now();
    const data: SessionData = {
      userId: user.id,
      username: user.username,
      globalName: user.global_name,
      avatarHash: user.avatar,
      accessTokenEnc: encrypt(token.access_token, this.config.sessionKey),
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
    };
    const sid = randomToken(32);
    await this.redis.client.set(this.key(sid), JSON.stringify(data), 'EX', ttlSeconds);
    return { sid, ttlSeconds };
  }

  async get(sid: string): Promise<SessionData | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(sid)) return null;
    const raw = await this.redis.client.get(this.key(sid));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  async destroy(sid: string): Promise<void> {
    await this.redis.client.del(this.key(sid));
  }

  async findActiveForUser(userId: string): Promise<SessionData | null> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.client.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 200);
      cursor = next;
      if (keys.length === 0) continue;
      const values = await this.redis.client.mget(...keys);
      for (const raw of values) {
        if (!raw) continue;
        try {
          const session = JSON.parse(raw) as SessionData;
          if (session.userId === userId && session.expiresAt > Date.now()) return session;
        } catch {
          continue;
        }
      }
    } while (cursor !== '0');
    return null;
  }

  accessToken(session: SessionData): string {
    return decrypt(session.accessTokenEnc, this.config.sessionKey);
  }
}
