import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestGuard } from './common/request.guard';
import { CoreModule } from './core/core.module';
import { GuildsModule } from './guilds/guilds.module';
import { HealthModule } from './health/health.module';
import { HttpMetricsInterceptor } from './metrics/http-metrics.interceptor';
import { MetricsModule } from './metrics/metrics.module';
import { TemplatesModule } from './templates/templates.module';
import { WelcomeModule } from './welcome/welcome.module';

@Module({
  imports: [CoreModule, AuthModule, GuildsModule, WelcomeModule, AssetsModule, TemplatesModule, HealthModule, MetricsModule],
  providers: [
    { provide: APP_GUARD, useClass: RequestGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useExisting: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
