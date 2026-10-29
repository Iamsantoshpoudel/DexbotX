import { Inject, Injectable, Logger } from '@nestjs/common';
import type { APIEmbed } from 'discord.js';
import { APP_CONFIG, AppConfig } from '../core/config';
import { RedisService } from '../redis/redis.service';
import { DiscordApiError, DiscordRestService } from './discord-rest.service';
import {
  ONBOARDING_CHANNEL_INTRO,
  ONBOARDING_COLOR,
  ONBOARDING_DM_CHANNEL_NOTE,
  ONBOARDING_DM_INTRO,
  ONBOARDING_STEPS,
  ONBOARDING_SUPPORT_LINE,
  ONBOARDING_TITLE,
} from './onboarding.constants';

export type ChannelOnboardingStatus = 'sent' | 'skipped' | 'failed';
export type DmOnboardingStatus = 'sent' | 'dm-closed' | 'failed' | 'skipped';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly discord: DiscordRestService,
    private readonly redis: RedisService,
  ) {}

  buildOnboardingEmbed(
    guildId: string,
    guildName: string,
    opts: { kind: 'channel'; inviterId?: string } | { kind: 'dm'; channelId?: string },
  ): APIEmbed {
    const title = ONBOARDING_TITLE.replace('{guildName}', guildName);
    const support = this.config.discordSupportUrl
      ? ONBOARDING_SUPPORT_LINE.replace('{supportUrl}', this.config.discordSupportUrl)
      : '';
    const steps = ONBOARDING_STEPS.map((line) => line.replace('{guildId}', guildId));
    const description = opts.kind === 'channel'
      ? [
          ONBOARDING_CHANNEL_INTRO.replace(
            '{greeting}',
            opts.inviterId ? `Hi <@${opts.inviterId}>!` : 'Hi server admins!',
          ),
          '',
          ...steps,
          ...(support ? ['', support] : []),
        ].join('\n')
      : [
          ONBOARDING_DM_INTRO.replace('{guildName}', guildName),
          ...(opts.channelId ? ['', ONBOARDING_DM_CHANNEL_NOTE.replace('{channelId}', opts.channelId)] : []),
          '',
          ...steps,
          ...(support ? ['', support] : []),
        ].join('\n');

    return {
      title,
      description,
      color: ONBOARDING_COLOR,
    };
  }

  async sendToChannel(
    channelId: string,
    guildId: string,
    guildName: string,
    inviterId?: string,
  ): Promise<ChannelOnboardingStatus> {
    try {
      await this.discord.createMessage(
        channelId,
        { embeds: [this.buildOnboardingEmbed(guildId, guildName, { kind: 'channel', inviterId })] },
        { users: inviterId ? [inviterId] : [] },
      );
      return 'sent';
    } catch {
      return 'failed';
    }
  }

  async sendDm(
    userId: string,
    guildId: string,
    guildName: string,
    channelId?: string,
  ): Promise<DmOnboardingStatus> {
    try {
      const { id } = await this.discord.createDmChannel(userId);
      await this.discord.createMessage(id, {
        embeds: [this.buildOnboardingEmbed(guildId, guildName, { kind: 'dm', channelId })],
      });
      return 'sent';
    } catch (error) {
      if (error instanceof DiscordApiError && (error.status === 403 || error.discordCode === 50007)) {
        return 'dm-closed';
      }
      return 'failed';
    }
  }

  async sendOnce(
    guildId: string,
    guildName: string,
    channelId: string | undefined,
    inviterId: string | undefined,
    dmUserId: string,
  ): Promise<{ channel: ChannelOnboardingStatus; dm: DmOnboardingStatus }> {
    const acquired = await this.redis.client.set(`onboard:${guildId}`, '1', 'EX', 30 * 24 * 60 * 60, 'NX');
    if (acquired !== 'OK') {
      this.logger.log(`Onboarding ${guildId}: channel skipped, dm skipped`);
      return { channel: 'skipped', dm: 'skipped' };
    }

    const channel = channelId
      ? await this.sendToChannel(channelId, guildId, guildName, inviterId)
      : 'skipped';
    const dm = await this.sendDm(dmUserId, guildId, guildName, channel === 'sent' ? channelId : undefined);
    this.logger.log(`Onboarding ${guildId}: channel ${channel}, dm ${dm}`);
    return { channel, dm };
  }
}
