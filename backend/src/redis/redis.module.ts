import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig, loadConfig } from '../core/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig() },
    RedisService,
  ],
  exports: [APP_CONFIG, RedisService],
})
export class RedisModule {}
