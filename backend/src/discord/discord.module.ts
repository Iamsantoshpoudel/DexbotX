import { Module } from '@nestjs/common';
import { ChannelAccessService } from './channel-access.service';
import { DiscordRestService } from './discord-rest.service';

@Module({
  providers: [DiscordRestService, ChannelAccessService],
  exports: [DiscordRestService, ChannelAccessService],
})
export class DiscordModule {}
