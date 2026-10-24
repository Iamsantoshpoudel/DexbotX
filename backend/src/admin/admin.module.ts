import { Module } from '@nestjs/common';
import { AdminController, PublicFlagsController } from './admin.controller';
import { AdminOverviewService } from './admin-overview.service';
import { AdminGuard } from './admin.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminOperationsService } from './admin-operations.service';
import { DiscordModule } from '../discord/discord.module';
import { StorageModule } from '../storage/storage.module';
import { AdminUsersContentService } from './admin-users-content.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [DiscordModule, StorageModule, QueueModule],
  controllers: [AdminController, PublicFlagsController],
  providers: [AdminGuard, AdminOverviewService, AdminAuditService, AdminOperationsService, AdminUsersContentService],
})
export class AdminModule {}
