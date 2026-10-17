import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { DiscordModule } from '../discord/discord.module';
import { MetricsModule } from '../metrics/metrics.module';
import { RenderModule } from '../render/render.module';
import { StorageModule } from '../storage/storage.module';
import { MemberEventsProcessor } from './member-events.processor';

@Module({
  imports: [CoreModule, RenderModule, DiscordModule, StorageModule, MetricsModule],
  providers: [MemberEventsProcessor],
})
export class WorkerModule {}
