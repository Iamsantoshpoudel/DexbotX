import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG, AppConfig } from '../core/config';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  private readonly extra: Redis[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.client = this.connect();
  }

  private connect(): Redis {
    const redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    redis.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    return redis;
  }

  /** A dedicated connection, needed for pub/sub subscribers. */
  createSubscriber(): Redis {
    const sub = this.connect();
    this.extra.push(sub);
    return sub;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.client, ...this.extra].map((c) => c.quit()));
  }
}
