import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseService } from '../db/database.service';
import { RateLimiter } from '../redis/rate-limiter.service';
import { RedisModule } from '../redis/redis.module';
import { SettingsCache } from '../redis/settings-cache.service';
import { StatsService } from '../admin/stats.service';
import { FeatureFlagsService } from './feature-flags.service';
import { loadConfig } from './config';

/** Infrastructure shared by the API process and every bot shard process. */
@Global()
@Module({
  imports: [
    RedisModule,
    LoggerModule.forRootAsync({
      useFactory: () => {
        const config = loadConfig();
        return {
          pinoHttp: {
            level: config.logLevel,
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                path: req.url?.split('?')[0],
              }),
              res: (res) => ({ statusCode: res.statusCode }),
            },
            customSuccessMessage: (req, res) =>
              `${req.method} ${req.url?.split('?')[0]} ${res.statusCode}`,
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
    DatabaseService,
    RateLimiter,
    SettingsCache,
    StatsService,
    FeatureFlagsService,
  ],
  exports: [DatabaseService, RedisModule, RateLimiter, SettingsCache, StatsService, FeatureFlagsService],
})
export class CoreModule {}
