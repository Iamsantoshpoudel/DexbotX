import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { and, count, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { guilds } from '../db/schema';
import { MEMBER_EVENTS_QUEUE, MemberEventJob } from '../queue/member-events.queue';
import { RedisService } from '../redis/redis.service';
import { StatsService } from './stats.service';

interface HealthCheck {
  ok: boolean;
  detail: string;
}

interface ShardHeartbeat {
  status: string;
  pingMs: number;
  guilds: number;
  reconnects: number;
  at: string;
}

interface DailyServerRow {
  date: string;
  total: number;
  joins: number;
  leaves: number;
}

interface DailyMessageRow {
  date: string;
  sent: number;
  failed: number;
}

@Injectable()
export class AdminOverviewService implements OnApplicationShutdown {
  private readonly logger = new Logger(AdminOverviewService.name);
  private readonly queue: Queue<MemberEventJob>;
  private readonly queueConnection: Redis;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly stats: StatsService,
  ) {
    this.queueConnection = this.redis.client.duplicate({ maxRetriesPerRequest: null });
    this.queue = new Queue<MemberEventJob>(MEMBER_EVENTS_QUEUE, { connection: this.queueConnection });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    this.queueConnection.disconnect();
  }

  async overview(): Promise<{
    health: { api: HealthCheck; redis: HealthCheck; postgres: HealthCheck; bot: HealthCheck; worker: HealthCheck };
    totals: { servers: number; usersEver: number; usersToday: number; messages24h: number; failed24h: number };
    shards: Array<{ id: string; status: string; pingMs: number; guilds: number; reconnects: number; at: string }>;
    series: { days: 30; servers: DailyServerRow[]; messages: DailyMessageRow[] };
    queue: { waiting: number; active: number; delayed: number; failed: number; oldestWaitingSeconds: number };
  }> {
    const cached = await this.redis.client.get('admin:overview').catch((error) => {
      this.logger.warn(`Overview cache read failed: ${(error as Error).message}`);
      return null;
    });
    if (cached) return JSON.parse(cached) as Awaited<ReturnType<AdminOverviewService['overview']>>;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayStats = await this.stats.day(30).catch((error) => {
      this.logger.warn(`Overview daily stats read failed: ${(error as Error).message}`);
      return [];
    });
    const counterByDate = new Map(dayStats.map((row) => [row.date, row.counters]));
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 29);

    const [healthRedis, healthPostgres, guildStats, heartbeats, totals, queue] = await Promise.all([
      this.checkRedis(),
      this.checkPostgres(),
      this.readGuildStats(start),
      this.stats.heartbeats('').catch((error) => {
        this.logger.warn(`Overview heartbeat read failed: ${(error as Error).message}`);
        return [];
      }),
      this.readTotals(today),
      this.readQueue().catch((error) => {
        this.logger.warn(`Overview queue read failed: ${(error as Error).message}`);
        return { waiting: 0, active: 0, delayed: 0, failed: 0, oldestWaitingSeconds: 0 };
      }),
    ]);

    const installed = guildStats.installed;
    const shardEntries = heartbeats.filter((entry) => entry.key.startsWith('shard:'));
    const shards = shardEntries.map(({ key, payload }) => ({
      id: key.slice('shard:'.length),
      ...(payload as ShardHeartbeat),
    })).sort((a, b) => Number(a.id) - Number(b.id));
    const workerHeartbeat = heartbeats.find((entry) => entry.key === 'worker')?.payload as { active: number; waiting: number; at: string } | undefined;

    const dbJoins = new Map(guildStats.joins.map((row) => [row.date, Number(row.total)]));
    const dbLeaves = new Map(guildStats.leaves.map((row) => [row.date, Number(row.total)]));
    const seriesDays: Array<{ date: string; joins: number; leaves: number; sent: number; failed: number }> = [];
    for (let offset = 0; offset < 30; offset++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      const label = date.toISOString().slice(0, 10);
      const counters = counterByDate.get(label) ?? {};
      const countedJoins = Number(counters.guild_joins ?? 0);
      const countedLeaves = Number(counters.guild_leaves ?? 0);
      seriesDays.push({
        date: label,
        joins: Math.max(countedJoins, dbJoins.get(label) ?? 0),
        leaves: Math.max(countedLeaves, dbLeaves.get(label) ?? 0),
        sent: Number(counters.msg_sent ?? 0),
        failed: Number(counters.msg_failed ?? 0),
      });
    }
    let total = installed - seriesDays.reduce((sum, row) => sum + row.joins - row.leaves, 0);
    const servers = seriesDays.map((row) => {
      total += row.joins - row.leaves;
      return { date: row.date, total: Math.max(0, total), joins: row.joins, leaves: row.leaves };
    });
    const messages = seriesDays.map(({ date, sent, failed }) => ({ date, sent, failed }));

    const result = {
      health: {
        api: { ok: true, detail: 'API responding' },
        redis: healthRedis,
        postgres: guildStats.ok ? healthPostgres : { ok: false, detail: 'Query failed' },
        bot: this.botHealth(shards),
        worker: this.workerHealth(workerHeartbeat),
      },
      totals: {
        servers: installed,
        usersEver: totals.usersEver,
        usersToday: totals.usersToday,
        messages24h: totals.messages24h,
        failed24h: totals.failed24h,
      },
      shards,
      series: { days: 30 as const, servers, messages },
      queue,
    };
    try {
      await this.redis.client.set('admin:overview', JSON.stringify(result), 'EX', 10);
    } catch (error) {
      this.logger.warn(`Overview cache write failed: ${(error as Error).message}`);
    }
    return result;
  }

  async rateLimits(): Promise<{
    perMinute: Array<{ minute: number; total: number; c401: number; c403: number; c404: number; c429: number }>;
    invalidLast10Min: number;
    recent429: Array<{ route: string; scope: string | null; retryAfter: number; global: boolean; at: string }>;
    blockedUntil: number | null;
    cache: Record<'settings' | 'channels' | 'userGuilds', number>;
    queue: { waiting: number; active: number; delayed: number; failed: number; oldestWaitingSeconds: number };
  }> {
    const [minutes, events, rawBlockedUntil, queue] = await Promise.all([
      this.stats.minutes(60),
      this.stats.events('d429'),
      this.redis.client.get('discord:blocked_until'),
      this.readQueue(),
    ]);
    const perMinute = minutes.map(({ minute, counters }) => ({
      minute,
      total: Number(counters.d_total ?? 0),
      c401: Number(counters.d_401 ?? 0),
      c403: Number(counters.d_403 ?? 0),
      c404: Number(counters.d_404 ?? 0),
      c429: Number(counters.d_429 ?? 0),
    }));
    const invalidLast10Min = perMinute.slice(-10).reduce((sum, row) => sum + row.c401 + row.c403 + row.c429, 0);
    const cache = {} as Record<'settings' | 'channels' | 'userGuilds', number>;
    for (const name of ['settings', 'channels', 'userGuilds'] as const) {
      const hit = minutes.reduce((sum, minute) => sum + Number(minute.counters[`cache:${name}:hit`] ?? 0), 0);
      const miss = minutes.reduce((sum, minute) => sum + Number(minute.counters[`cache:${name}:miss`] ?? 0), 0);
      cache[name] = hit + miss === 0 ? 0 : Math.round((hit / (hit + miss)) * 100);
    }
    return {
      perMinute,
      invalidLast10Min,
      recent429: events.slice(0, 20) as Array<{ route: string; scope: string | null; retryAfter: number; global: boolean; at: string }>,
      blockedUntil: rawBlockedUntil ? Number(rawBlockedUntil) : null,
      cache,
      queue,
    };
  }

  private async readTotals(today: string) {
    try {
      const [usersEver, usersToday, messages24h, failed24h] = await Promise.all([
        this.stats.uniqueCount('logins', 'all'),
        this.stats.uniqueCount('logins', today),
        this.stats.sumRecentMinutes('msg_sent', 1440),
        this.stats.sumRecentMinutes('msg_failed', 1440),
      ]);
      return { usersEver, usersToday, messages24h, failed24h };
    } catch (error) {
      this.logger.warn(`Overview totals read failed: ${(error as Error).message}`);
      return { usersEver: 0, usersToday: 0, messages24h: 0, failed24h: 0 };
    }
  }

  private async readGuildStats(start: Date) {
    try {
      const [installedRows, joins, leaves] = await Promise.all([
        this.database.db.select({ total: count() }).from(guilds).where(eq(guilds.installed, true)),
        this.database.db
          .select({ date: sql<string>`to_char(${guilds.joinedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, total: count() })
          .from(guilds)
          .where(gte(guilds.joinedAt, start))
          .groupBy(sql`1`),
        this.database.db
          .select({ date: sql<string>`to_char(${guilds.leftAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, total: count() })
          .from(guilds)
          .where(and(gte(guilds.leftAt, start), isNotNull(guilds.leftAt)))
          .groupBy(sql`1`),
      ]);
      return { ok: true, installed: Number(installedRows[0]?.total ?? 0), joins, leaves };
    } catch (error) {
      this.logger.warn(`Overview server stats read failed: ${(error as Error).message}`);
      return { ok: false, installed: 0, joins: [], leaves: [] };
    }
  }

  private async readQueue() {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
    const oldest = await this.queue.getWaiting(0, 0);
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      oldestWaitingSeconds: oldest[0] ? Math.max(0, Math.floor((Date.now() - oldest[0].timestamp) / 1000)) : 0,
    };
  }

  private async checkRedis(): Promise<HealthCheck> {
    try {
      await this.redis.client.ping();
      return { ok: true, detail: 'Connected' };
    } catch {
      return { ok: false, detail: 'Connection failed' };
    }
  }

  private async checkPostgres(): Promise<HealthCheck> {
    try {
      await this.database.ping();
      return { ok: true, detail: 'Connected' };
    } catch {
      return { ok: false, detail: 'Connection failed' };
    }
  }

  private botHealth(shards: Array<{ id: string; status: string; at: string }>): HealthCheck {
    const fresh = shards.filter((shard) => Date.now() - Date.parse(shard.at) < 45_000);
    const ok = fresh.length > 0 && fresh.every((shard) => shard.status === 'online');
    return { ok, detail: ok ? `${fresh.length} shard(s) online` : fresh.length ? 'Shard reconnecting' : 'No recent shard heartbeat' };
  }

  private workerHealth(worker: { active: number; waiting: number; at: string } | undefined): HealthCheck {
    const ok = !!worker && Date.now() - Date.parse(worker.at) < 45_000;
    return { ok, detail: ok ? `Active ${worker.active}, waiting ${worker.waiting}` : 'No recent worker heartbeat' };
  }
}
