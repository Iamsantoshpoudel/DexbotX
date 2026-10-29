import { Module } from '@nestjs/common';
import { ChannelAccessService } from './channel-access.service';
import { DiscordRestService } from './discord-rest.service';
import { OnboardingService } from './onboarding.service';

@Module({
  providers: [DiscordRestService, ChannelAccessService, OnboardingService],
  exports: [DiscordRestService, ChannelAccessService, OnboardingService],
})
export class DiscordModule {}
