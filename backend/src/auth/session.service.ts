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

  private userIndexKey(userId: string): string {
    return `usess:${userId}`;
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
    const sidHash = sha256Hex(sid);
    await this.redis.client.set(`sess:${sidHash}`, JSON.stringify(data), 'EX', ttlSeconds);
    await this.redis.client.sadd(this.userIndexKey(user.id), sidHash);
    await this.redis.client.expire(this.userIndexKey(user.id), ttlSeconds);
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
    const session = await this.get(sid);
    await this.redis.client.del(this.key(sid));
    if (session) await this.redis.client.srem(this.userIndexKey(session.userId), sha256Hex(sid));
  }

  async destroyAllForUser(userId: string): Promise<number> {
    const script = [
      "local hashes = redis.call('SMEMBERS', KEYS[1])",
      'local deleted = 0',
      'for _, hash in ipairs(hashes) do',
      "  deleted = deleted + redis.call('DEL', 'sess:' .. hash)",
      'end',
      "redis.call('DEL', KEYS[1])",
      'return deleted',
    ].join('\n');
    return Number(await this.redis.client.eval(script, 1, this.userIndexKey(userId)));
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
