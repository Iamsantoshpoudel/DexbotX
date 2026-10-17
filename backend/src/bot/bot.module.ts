import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { QueueModule } from '../queue/queue.module';
import { BotService } from './bot.service';
import { GuildSyncService } from './guild-sync.service';

@Module({
  imports: [CoreModule, QueueModule],
  providers: [BotService, GuildSyncService],
})
export class BotModule {}
