import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface TimedStats {
  date: string;
  counters: Record<string, string>;
}

export interface MinuteStats {
  minute: number;
  counters: Record<string, string>;
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly redis: RedisService) {}

  async uniqueCount(name: string, date: string | 'all'): Promise<number> {
    return this.redis.client.pfcount(`stat:uniq:${name}:${date}`);
  }

  async sumRecentMinutes(name: string, minutes: number): Promise<number> {
    const count = Math.max(0, Math.floor(minutes));
    const end = Math.floor(Date.now() / 60_000);
    const pipeline = this.redis.client.pipeline();
    for (let offset = 0; offset < count; offset++) {
      pipeline.hget(`stat:recent-min:${end - offset}`, name);
    }
    const results = await pipeline.exec();
    return (results ?? []).reduce((total, [error, value]) => {
      if (error) throw error;
      return total + Number(value ?? 0);
    }, 0);
  }

  async incr(name: string, n = 1): Promise<void> {
    const now = new Date();
    const dayKey = `stat:day:${now.toISOString().slice(0, 10)}`;
    const minuteKey = `stat:min:${Math.floor(now.getTime() / 60_000)}`;
    await this.record(`increment ${name}`, async () => {
      const results = await this.redis.client
        .multi()
        .hincrby(dayKey, name, n)
        .expire(dayKey, 90 * 24 * 60 * 60)
        .hincrby(minuteKey, name, n)
        .expire(minuteKey, 2 * 60 * 60)
        .hincrby(`stat:recent-min:${Math.floor(now.getTime() / 60_000)}`, name, n)
        .expire(`stat:recent-min:${Math.floor(now.getTime() / 60_000)}`, 25 * 60 * 60)
        .exec();
      const failure = results?.find(([error]) => error)?.[0];
      if (failure) throw failure;
    });
  }

  async addUnique(name: string, id: string): Promise<void> {
    const dailyKey = `stat:uniq:${name}:${new Date().toISOString().slice(0, 10)}`;
    const allKey = `stat:uniq:${name}:all`;
    await this.record(`add unique ${name}`, async () => {
      const results = await this.redis.client
        .multi()
        .pfadd(dailyKey, id)
        .expire(dailyKey, 90 * 24 * 60 * 60)
        .pfadd(allKey, id)
        .exec();
      const failure = results?.find(([error]) => error)?.[0];
      if (failure) throw failure;
    });
  }

  hit(namespace: string): Promise<void> {
    return this.incr(`cache:${namespace}:hit`);
  }

  miss(namespace: string): Promise<void> {
    return this.incr(`cache:${namespace}:miss`);
  }

  async pushEvent(listName: string, obj: unknown, max = 50): Promise<void> {
    const key = `stat:ev:${listName}`;
    await this.record(`push event ${listName}`, async () => {
      const results = await this.redis.client.multi().lpush(key, JSON.stringify(obj)).ltrim(key, 0, Math.max(0, max - 1)).exec();
      const failure = results?.find(([error]) => error)?.[0];
      if (failure) throw failure;
    });
  }

  async heartbeat(key: string, payload: unknown, ttl = 45): Promise<void> {
    await this.record(`heartbeat ${key}`, async () => {
      await this.redis.client.set(`hb:${key}`, JSON.stringify(payload), 'EX', ttl);
    });
  }

  async day(rangeDays: number): Promise<TimedStats[]> {
    const days = Math.max(0, Math.floor(rangeDays));
    return Promise.all(
      Array.from({ length: days }, async (_, index) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - index);
        const day = date.toISOString().slice(0, 10);
        const counters = await this.redis.client.hgetall(`stat:day:${day}`);
        return { date: day, counters };
      }),
    );
  }

  async minutes(last = 60): Promise<MinuteStats[]> {
    const count = Math.max(0, Math.floor(last));
    const now = Math.floor(Date.now() / 60_000);
    return Promise.all(
      Array.from({ length: count }, async (_, index) => {
        const minute = now - (count - index - 1);
        const counters = await this.redis.client.hgetall(`stat:min:${minute}`);
        return { minute, counters };
      }),
    );
  }

  async events(listName: string): Promise<unknown[]> {
    const entries = await this.redis.client.lrange(`stat:ev:${listName}`, 0, -1);
    return entries.map((entry) => JSON.parse(entry) as unknown);
  }

  async heartbeats(prefix: string): Promise<Array<{ key: string; payload: unknown }>> {
    const pattern = `hb:${prefix}*`;
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [nextCursor, batch] = await this.redis.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    const entries = await Promise.all(keys.map(async (key) => {
      const value = await this.redis.client.get(key);
      return value === null ? null : { key: key.slice(3), payload: JSON.parse(value) as unknown };
    }));
    return entries.filter((entry): entry is { key: string; payload: unknown } => entry !== null);
  }

  private async record(operation: string, run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.warn(`Stats write failed (${operation}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
