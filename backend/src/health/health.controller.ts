import { Controller, Get, Head, HttpException, HttpStatus, Injectable, Logger, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators';
import { DatabaseService } from '../db/database.service';
import { RedisService } from '../redis/redis.service';

const CHECK_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 10_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

interface StatusResult {
  ok: boolean;
  services: {
    api: boolean;
    database: boolean;
    redis: boolean;
    bot: boolean;
    worker: boolean;
    discord: boolean;
  };
  checkedAt: string;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

async function withTimeout<T>(check: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(check),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
@Controller('dexbotx')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly rateLimits = new Map<string, RateLimitBucket>();
  private cached?: { result: StatusResult; expiresAt: number };
  private inFlight?: Promise<StatusResult>;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('health')
  getStatus(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<StatusResult> {
    return this.respond(req, res);
  }

  @Public()
  @Head('health')
  headStatus(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<StatusResult> {
    return this.respond(req, res);
  }

  private async respond(req: Request, res: Response): Promise<StatusResult> {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex');

    const retryAfter = this.takeRateLimit(req.ip ?? 'unknown');
    if (retryAfter !== undefined) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many requests', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.getResult();
    res.status(result.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }

  private takeRateLimit(ip: string): number | undefined {
    const now = Date.now();
    for (const [key, bucket] of this.rateLimits) {
      if (bucket.resetAt <= now) this.rateLimits.delete(key);
    }
    const bucket = this.rateLimits.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      this.rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return undefined;
    }
    bucket.count++;
    return bucket.count > RATE_LIMIT_MAX ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : undefined;
  }

  private getResult(): Promise<StatusResult> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return Promise.resolve(this.cached.result);
    if (this.inFlight) return this.inFlight;

    const pending = this.checkServices()
      .then((result) => {
        this.cached = { result, expiresAt: Date.now() + CACHE_TTL_MS };
        return result;
      })
      .finally(() => {
        if (this.inFlight === pending) this.inFlight = undefined;
      });
    this.inFlight = pending;
    return pending;
  }

  private async checkServices(): Promise<StatusResult> {
    const [database, redis, bot, worker, discord] = await Promise.all([
      this.check('database', () => this.database.ping()),
      this.check('redis', async () => {
        const clients = [this.redis.client, this.redis.cacheClient].filter((client) => client !== undefined);
        await Promise.all(clients.map((client) => client.ping()));
      }),
      this.check('bot', async () => {
        if (!(await this.redis.client.get('hb:bot'))) throw new Error('heartbeat unavailable');
      }),
      this.check('worker', async () => {
        if (!(await this.redis.client.get('hb:worker'))) throw new Error('heartbeat unavailable');
      }),
      this.check('discord', async () => {
        const blockedUntil = Number(await this.redis.client.get('discord:blocked_until'));
        if (Number.isFinite(blockedUntil) && blockedUntil > Date.now()) throw new Error('Discord is blocked');
      }),
    ]);
    const services = { api: true, database, redis, bot, worker, discord };
    const ok = Object.values(services).every(Boolean);
    const checkedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return { ok, services, checkedAt };
  }

  private async check(name: string, run: () => Promise<unknown>): Promise<boolean> {
    try {
      await withTimeout(run);
      return true;
    } catch {
      this.logger.warn(`Health check failed: ${name}`);
      return false;
    }
  }
}
