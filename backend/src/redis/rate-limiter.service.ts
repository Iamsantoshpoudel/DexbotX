import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Fixed-window counter in Redis. Shared by every API instance and bot shard. */
@Injectable()
export class RateLimiter {
  constructor(private readonly redis: RedisService) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    const res = await this.redis.client.multi().incr(redisKey).ttl(redisKey).exec();
    const count = Number(res?.[0]?.[1] ?? 0);
    let ttl = Number(res?.[1]?.[1] ?? -1);
    if (ttl < 0) {
      // First hit, or a key that lost its expiry: (re)set it so counters can never get stuck.
      await this.redis.client.expire(redisKey, windowSeconds);
      ttl = windowSeconds;
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, ttl),
    };
  }
}
