import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/decorators';
import { DatabaseService } from '../db/database.service';
import { RedisService } from '../redis/redis.service';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: the process is up. */
  @Public()
  @Get()
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies answer. Use this for load balancer checks. */
  @Public()
  @Get('ready')
  async ready() {
    const [db, redis] = await Promise.allSettled([withTimeout(this.database.ping(), 2000), withTimeout(this.redis.client.ping(), 2000)]);
    const body = { status: db.status === 'fulfilled' && redis.status === 'fulfilled' ? 'ok' : 'degraded', db: db.status === 'fulfilled', redis: redis.status === 'fulfilled' };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
