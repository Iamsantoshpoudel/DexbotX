import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseService } from '../db/database.service';
import { RateLimiter } from '../redis/rate-limiter.service';
import { RedisService } from '../redis/redis.service';
import { SettingsCache } from '../redis/settings-cache.service';
import { APP_CONFIG, AppConfig, loadConfig } from './config';

/** Infrastructure shared by the API process and every bot shard process. */
@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => {
        const config = loadConfig();
        return {
          pinoHttp: {
            level: config.logLevel,
            redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
            autoLogging: { ignore: (req) => /^\/(health|metrics)/.test(req.url ?? '') },
            // Pretty logs only in local development; production emits JSON for log aggregation.
            transport: config.nodeEnv === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
          },
        };
      },
    }),
  ],
  providers: [
    { provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig() },
    DatabaseService,
    RedisService,
    RateLimiter,
    SettingsCache,
  ],
  exports: [APP_CONFIG, DatabaseService, RedisService, RateLimiter, SettingsCache],
})
export class CoreModule {}
